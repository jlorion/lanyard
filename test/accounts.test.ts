// End-to-end account flow against a throwaway ~/.ssh (requires ssh-keygen and ssh).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard-test-'));
process.env.LANYARD_SSH_DIR = path.join(sandbox, '.ssh');
process.env.LANYARD_HOME = path.join(sandbox, '.lanyard');

const core = await import('../src/core');

const ME = { gitName: 'Jane Doe', gitEmail: 'jane@example.com' };
const USER_CONFIG = 'IdentityFile ~/.ssh/id_global\n\nHost box\n    HostName 1.2.3.4\n';
const readConfig = () => fs.readFileSync(core.paths.config, 'utf8');

beforeAll(() => {
  fs.mkdirSync(process.env.LANYARD_SSH_DIR!, { recursive: true });
  fs.writeFileSync(core.paths.config, USER_CONFIG);
});
afterAll(() => fs.rmSync(sandbox, { recursive: true, force: true }));

describe('accounts', () => {
  it('adds accounts, switches between them and keeps user config intact', async () => {
    const work = await core.accounts.add({ provider: 'github', name: 'work', generate: { type: 'ed25519' }, ...ME });
    expect(work.publicKey).toMatch(/^ssh-ed25519 /);
    expect(work.account.active).toBe(true); // first account becomes active

    await core.accounts.add({ provider: 'github', name: 'personal', generate: { type: 'ed25519' }, ...ME });
    let cfg = readConfig();
    expect(cfg).toMatch(/Host github\.com\n {4}User git\n {4}IdentityFile \S+\/id_ed25519_github_work\n/);
    expect(cfg).toMatch(/Host github\.com-personal\n {4}HostName github\.com/);
    expect(cfg.endsWith(USER_CONFIG)).toBe(true);

    await core.accounts.use('github', 'personal');
    cfg = readConfig();
    expect(cfg).toMatch(/active account: personal\nHost github\.com\n {4}User git\n {4}IdentityFile \S+\/id_ed25519_github_personal/);

    const github = core.accounts.overview().find((p) => p.id === 'github')!;
    expect(github.active).toBe('personal');
    expect(github.accounts).toHaveLength(2);
    expect(core.backups.list('config').length).toBeGreaterThanOrEqual(3); // every write is backed up

    await core.accounts.remove('github', 'personal', { deleteKey: true });
    await core.accounts.remove('github', 'work');
    expect(readConfig()).toBe(USER_CONFIG); // managed section disappears with the last account
    expect(core.keys.list().map((k) => k.name)).toEqual(['id_ed25519_github_work']);
  });
});

describe('account identity', () => {
  it('requires a git user.name and a valid user.email', async () => {
    const base = { provider: 'github', name: 'x', keyPath: 'id_ed25519_github_work' };
    await expect(core.accounts.add({ ...base })).rejects.toThrow(/user\.name is required/);
    await expect(core.accounts.add({ ...base, gitName: 'Jane' })).rejects.toThrow(/valid git user\.email/);
    await expect(core.accounts.add({ ...base, gitName: 'Jane', gitEmail: 'not-an-email' })).rejects.toThrow(/valid git user\.email/);
    expect(core.accounts.list('github').some((a) => a.name === 'x')).toBe(false); // nothing half-created
  });

  it('accepts no-reply addresses, trims input, and refuses blanking on edit', async () => {
    const r = await core.accounts.add({
      provider: 'github',
      name: 'noreply',
      keyPath: 'id_ed25519_github_work',
      gitName: '  Jane  ',
      gitEmail: ' 12345+jane@users.noreply.github.com ',
    });
    expect(r.account).toMatchObject({ gitName: 'Jane', gitEmail: '12345+jane@users.noreply.github.com' });
    await expect(core.accounts.update('github', 'noreply', { gitEmail: '' })).rejects.toThrow(/valid git user\.email/);
    await core.accounts.remove('github', 'noreply');
  });
});

describe('hosts', () => {
  it('supports CRUD through the service', () => {
    core.hosts.save({
      patterns: 'db',
      options: [
        { key: 'HostName', value: 'db.internal' },
        { key: 'User', value: 'me' },
      ],
    });
    const db = core.hosts.list().find((h) => h.alias === 'db')!;
    expect(db.user).toBe('me');
    expect(() => core.hosts.save({ patterns: 'box', options: [] })).toThrow(/already uses/);
    core.hosts.remove(db.index, 'db');
    expect(core.hosts.list().some((h) => h.alias === 'db')).toBe(false);
  });

  it('switches the key of a host in place and enforces IdentitiesOnly', async () => {
    await core.keys.generate({ name: 'id_a' });
    await core.keys.generate({ name: 'id_b' });
    core.hosts.save({
      patterns: 'srv',
      options: [
        { key: 'HostName', value: 'srv.local' },
        { key: 'IdentityFile', value: '~/old' },
        { key: 'User', value: 'me' },
      ],
    });

    let srv = core.hosts.setKey('srv', 'id_a');
    expect(srv.options.map((o) => o.key)).toEqual(['HostName', 'IdentityFile', 'User', 'IdentitiesOnly']);
    expect(srv.identityFile).toMatch(/\/id_a$/);

    srv = core.hosts.setKey('srv', 'id_b');
    expect(srv.identityFile).toMatch(/\/id_b$/);
    expect(srv.options.filter((o) => o.key === 'IdentitiesOnly')).toHaveLength(1);

    srv = core.hosts.setKey('srv', null);
    expect(srv.options.map((o) => o.key)).toEqual(['HostName', 'User']);
    expect(() => core.hosts.setKey('srv', 'id_missing')).toThrow(/not found/);
    core.hosts.remove(srv.index, 'srv');
  });

  it('tags git hosts so they are tested rather than connected to', () => {
    core.hosts.save({ patterns: 'github.com', options: [{ key: 'User', value: 'git' }] });
    core.hosts.save({ patterns: 'my-gh', options: [{ key: 'HostName', value: 'github.com' }] });
    core.hosts.save({ patterns: 'srv2', options: [{ key: 'HostName', value: '10.0.0.2' }] });

    const byAlias = Object.fromEntries(
      core.hosts
        .list()
        .filter((h) => !h.managed)
        .map((h) => [h.alias, h.gitProvider]),
    );
    expect(byAlias).toMatchObject({ 'github.com': 'github', 'my-gh': 'github', srv2: null });
    expect(core.hosts.gitProviderFor('hf.co')).toBe('Hugging Face'); // not in the config at all
    expect(core.hosts.connectable().map((h) => h.alias)).toEqual(expect.not.arrayContaining(['github.com', 'my-gh']));

    for (const alias of ['github.com', 'my-gh', 'srv2']) {
      const h = core.hosts.list().find((x) => !x.managed && x.alias === alias)!;
      core.hosts.remove(h.index, h.patterns);
    }
  });

  it('reports taken key names and suggests a free one', async () => {
    await core.keys.generate({ name: 'id_taken' });
    fs.writeFileSync(path.join(process.env.LANYARD_SSH_DIR!, 'id_taken_2.pub'), 'ssh-ed25519 AAAA x');
    expect(core.keys.checkName('id_taken')).toMatchObject({ valid: true, exists: true, suggestion: 'id_taken_3' });
    expect(core.keys.checkName('id_free')).toMatchObject({ valid: true, exists: false });
    expect(core.keys.checkName('bad name')).toMatchObject({ valid: false });
    expect(core.keys.checkName('')).toMatchObject({ valid: false });
  });

  it('validates configs with OpenSSH', async () => {
    expect((await core.hosts.validate('Host a\n  HostName b\n')).ok).toBe(true);
    expect((await core.hosts.validate('Host a\n  NotARealOption yes\n')).ok).toBe(false);
  });
});
