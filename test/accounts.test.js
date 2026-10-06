'use strict';

// End-to-end account flow against a throwaway ~/.ssh (requires ssh-keygen).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sshm-test-'));
process.env.SSHM_SSH_DIR = path.join(sandbox, '.ssh');
process.env.SSHM_HOME = path.join(sandbox, '.sshm');

const core = require('../src/core');

test.after(() => fs.rmSync(sandbox, { recursive: true, force: true }));

const USER_CONFIG = 'IdentityFile ~/.ssh/id_global\n\nHost box\n    HostName 1.2.3.4\n';

test('add accounts, switch between them, keep user config intact', async () => {
  fs.mkdirSync(process.env.SSHM_SSH_DIR, { recursive: true });
  fs.writeFileSync(core.paths.config, USER_CONFIG);

  const work = await core.accounts.add({ provider: 'github', name: 'work', generate: { type: 'ed25519' } });
  assert.match(work.publicKey, /^ssh-ed25519 /);
  assert.equal(work.account.active, true, 'first account becomes active');

  await core.accounts.add({ provider: 'github', name: 'personal', generate: { type: 'ed25519' } });
  let cfg = fs.readFileSync(core.paths.config, 'utf8');
  assert.match(cfg, /Host github\.com\n    User git\n    IdentityFile \S+\/id_ed25519_github_work\n/);
  assert.match(cfg, /Host github\.com-personal\n    HostName github\.com/);
  assert.ok(cfg.endsWith(USER_CONFIG), 'user content preserved verbatim after the managed section');

  await core.accounts.use('github', 'personal');
  cfg = fs.readFileSync(core.paths.config, 'utf8');
  assert.match(cfg, /active account: personal\nHost github\.com\n    User git\n    IdentityFile \S+\/id_ed25519_github_personal/);

  const ov = core.accounts.overview().find((p) => p.id === 'github');
  assert.equal(ov.active, 'personal');
  assert.equal(ov.accounts.length, 2);

  assert.ok(core.backups.list('config').length >= 3, 'every write is backed up');

  await core.accounts.remove('github', 'personal', { deleteKey: true });
  await core.accounts.remove('github', 'work');
  assert.equal(fs.readFileSync(core.paths.config, 'utf8'), USER_CONFIG, 'managed section disappears with the last account');
  assert.equal(core.keys.list().map((k) => k.name).join(), 'id_ed25519_github_work');
});

test('host CRUD through the service', () => {
  core.hosts.save({ patterns: 'db', options: [{ key: 'HostName', value: 'db.internal' }, { key: 'User', value: 'me' }] });
  const db = core.hosts.list().find((h) => h.alias === 'db');
  assert.equal(db.user, 'me');
  assert.throws(() => core.hosts.save({ patterns: 'box', options: [] }), /already uses/);
  core.hosts.remove(db.index, 'db');
  assert.equal(core.hosts.list().some((h) => h.alias === 'db'), false);
});

test('config validation uses OpenSSH', async () => {
  const repo = require('../src/core/ssh-config/config.repository');
  assert.equal((await repo.validate('Host a\n  HostName b\n')).ok, true);
  const bad = await repo.validate('Host a\n  NotARealOption yes\n');
  assert.equal(bad.ok, false);
});
