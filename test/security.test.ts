// Regression tests for the security audit fixes (see SECURITY.md). Requires ssh-keygen.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard-sec-'));
process.env.LANYARD_SSH_DIR = path.join(sandbox, '.ssh');
process.env.LANYARD_HOME = path.join(sandbox, '.lanyard');

const core = await import('../src/core');
const { openTerminal } = await import('../src/core/terminal/terminal');

beforeAll(() => fs.mkdirSync(process.env.LANYARD_SSH_DIR!, { recursive: true }));
afterAll(() => fs.rmSync(sandbox, { recursive: true, force: true }));

// Linux and macOS type passphrases into ssh-keygen's prompts through stdin;
// Windows OpenSSH only reads the console, so there they go in -P / -N.
describe("passphrases stay out of other users' reach", () => {
  it('generates an encrypted key and changes its passphrase', async () => {
    const key = await core.keys.generate({ name: 'id_secret', passphrase: 'first pass phrase' });
    expect(key.encrypted).toBe(true);

    await expect(core.keys.changePassphrase('id_secret', 'wrong', 'x')).rejects.toThrow(/Could not change passphrase/);
    await core.keys.changePassphrase('id_secret', 'first pass phrase', 'second');
    await core.keys.changePassphrase('id_secret', 'second', ''); // remove it
    expect(core.keys.get('id_secret').encrypted).toBe(false);
    await core.keys.changePassphrase('id_secret', '', 'third'); // add one to an unencrypted key
    expect(core.keys.get('id_secret').encrypted).toBe(true);
  }, 60000);
});

describe('destructive key operations only touch keys', () => {
  it('refuses to trash or re-permission a file that is not an SSH key', async () => {
    const doc = path.join(sandbox, 'thesis.docx');
    fs.writeFileSync(doc, 'not a key');
    expect(() => core.keys.remove(doc)).toThrow(/Not an SSH key/);
    await expect(core.keys.fixPermissions(doc)).rejects.toThrow(/Not an SSH key/);
    expect(fs.existsSync(doc)).toBe(true);
  });
});

describe('arguments cannot turn into options or commands', () => {
  it('rejects host aliases and known_hosts hosts that start with "-"', async () => {
    expect(() => core.hosts.assertAlias('-oProxyCommand=calc')).toThrow(/Invalid host alias/);
    expect(core.hosts.assertAlias('github.com-work')).toBe('github.com-work');
    await expect(core.knownHosts.scan('-v')).rejects.toThrow(/Invalid host/);
  });

  it('keeps every ssh_config option on one line', () => {
    const inject = { key: 'HostName', value: 'example.com\nProxyCommand calc.exe' };
    expect(() => core.hosts.save({ patterns: 'evil', options: [inject] })).toThrow(/single line/);
    expect(() => core.hosts.save({ patterns: 'evil', options: [{ key: 'Host other', value: 'x' }] })).toThrow(/Invalid option name/);
    expect(core.hosts.list().some((h) => h.alias === 'evil')).toBe(false);
  });

  it('refuses shell metacharacters, including typographic quotes, before opening a terminal', () => {
    expect(() => openTerminal('ssh', ['box’; calc'])).toThrow(/unsafe argument/);
    expect(() => openTerminal('ssh', ['box'], { title: 'x & calc' })).toThrow(/unsafe argument/);
  });
});
