// End-to-end account flow against a throwaway ~/.ssh (requires ssh-keygen and ssh).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sshm-test-'));
process.env.SSHM_SSH_DIR = path.join(sandbox, '.ssh');
process.env.SSHM_HOME = path.join(sandbox, '.sshm');

const core = await import('../src/core');

const USER_CONFIG = 'IdentityFile ~/.ssh/id_global\n\nHost box\n    HostName 1.2.3.4\n';
const readConfig = () => fs.readFileSync(core.paths.config, 'utf8');

beforeAll(() => {
  fs.mkdirSync(process.env.SSHM_SSH_DIR!, { recursive: true });
  fs.writeFileSync(core.paths.config, USER_CONFIG);
});
afterAll(() => fs.rmSync(sandbox, { recursive: true, force: true }));

describe('accounts', () => {
  it('adds accounts, switches between them and keeps user config intact', async () => {
    const work = await core.accounts.add({ provider: 'github', name: 'work', generate: { type: 'ed25519' } });
    expect(work.publicKey).toMatch(/^ssh-ed25519 /);
    expect(work.account.active).toBe(true); // first account becomes active

    await core.accounts.add({ provider: 'github', name: 'personal', generate: { type: 'ed25519' } });
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

describe('hosts', () => {
  it('supports CRUD through the service', () => {
    core.hosts.save({ patterns: 'db', options: [{ key: 'HostName', value: 'db.internal' }, { key: 'User', value: 'me' }] });
    const db = core.hosts.list().find((h) => h.alias === 'db')!;
    expect(db.user).toBe('me');
    expect(() => core.hosts.save({ patterns: 'box', options: [] })).toThrow(/already uses/);
    core.hosts.remove(db.index, 'db');
    expect(core.hosts.list().some((h) => h.alias === 'db')).toBe(false);
  });

  it('validates configs with OpenSSH', async () => {
    expect((await core.hosts.validate('Host a\n  HostName b\n')).ok).toBe(true);
    expect((await core.hosts.validate('Host a\n  NotARealOption yes\n')).ok).toBe(false);
  });
});
