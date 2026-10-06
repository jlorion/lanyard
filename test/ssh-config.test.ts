import { describe, expect, it } from 'vitest';
import * as sshConfig from '../src/core/ssh-config';

const SAMPLE = [
  '# my config',
  'AddKeysToAgent yes',
  '',
  '# work server',
  'Host work',
  '  HostName 10.0.0.5',
  '  User deploy',
  '  # keep this comment',
  '  Port 2222',
  '',
  'Host *',
  '  ServerAliveInterval 60',
  '',
].join('\n');

describe('ssh-config parser/editor', () => {
  it('round-trips untouched content byte for byte', () => {
    expect(sshConfig.serialize(sshConfig.parse(SAMPLE))).toBe(SAMPLE);
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    expect(sshConfig.serialize(sshConfig.parse(crlf))).toBe(crlf);
  });

  it('lists hosts with leading comments', () => {
    const hosts = sshConfig.listHosts(sshConfig.parse(SAMPLE));
    expect(hosts.map((h) => h.alias)).toEqual(['work', '*']);
    expect(hosts[0].comment).toBe('work server');
    expect(hosts[0].port).toBe('2222');
    expect(hosts[1].isPattern).toBe(true);
  });

  it('updates in place, keeps comments, appends new options', () => {
    const model = sshConfig.parse(SAMPLE);
    sshConfig.updateHost(model, 0, 'work', {
      patterns: 'work',
      options: [
        { key: 'HostName', value: '10.0.0.6' },
        { key: 'Port', value: '2222' },
        { key: 'IdentityFile', value: '~/.ssh/my key' },
      ],
    });
    const out = sshConfig.serialize(model);
    expect(out).toMatch(/ {2}HostName 10\.0\.0\.6\n/);
    expect(out).not.toMatch(/User deploy/);
    expect(out).toMatch(/# keep this comment/);
    expect(out).toMatch(/ {2}IdentityFile "~\/\.ssh\/my key"\n\nHost \*/);
  });

  it('adds new hosts before a trailing Host *', () => {
    const model = sshConfig.parse(SAMPLE);
    sshConfig.addHost(model, { patterns: 'db', options: [{ key: 'HostName', value: 'db.local' }] });
    expect(sshConfig.listHosts(model).map((h) => h.alias)).toEqual(['work', 'db', '*']);
  });

  it('detects stale edits', () => {
    const model = sshConfig.parse(SAMPLE);
    expect(() => sshConfig.removeHost(model, 0, 'not-work')).toThrow(/changed on disk/);
  });

  it('places the managed section on top and replaces it on re-render', () => {
    const model = sshConfig.parse(SAMPLE);
    model.managedLines = sshConfig.renderManaged([
      { comment: 'GitHub', patterns: 'github.com', options: [{ key: 'IdentityFile', value: '~/.ssh/a' }] },
    ]);
    const once = sshConfig.serialize(model);
    expect(once.startsWith(sshConfig.MANAGED_BEGIN)).toBe(true);
    expect(once).toMatch(/Host \*\n# <<< lanyard managed section <<<\n\n# my config/);

    const again = sshConfig.parse(once);
    expect(sshConfig.serialize(again)).toBe(once);
    const hosts = sshConfig.listHosts(again);
    expect(hosts[0].managed).toBe(true);
    expect(hosts.filter((h) => h.managed)).toHaveLength(1); // the Host * terminator is hidden

    again.managedLines = [];
    expect(sshConfig.serialize(again)).toBe(SAMPLE);
  });

  it('migrates a pre-rename (sshm) managed section in place instead of duplicating it', () => {
    const legacy = [
      '# >>> sshm managed section >>>',
      'Host github.com',
      '    IdentityFile ~/.ssh/old',
      'Host *',
      '# <<< sshm managed section <<<',
      '',
      SAMPLE,
    ].join('\n');
    const model = sshConfig.parse(legacy);
    expect(model.managedLines).toHaveLength(5);
    model.managedLines = sshConfig.renderManaged([
      { comment: '', patterns: 'github.com', options: [{ key: 'IdentityFile', value: '~/.ssh/new' }] },
    ]);
    const out = sshConfig.serialize(model);
    expect(out).not.toMatch(/sshm managed section/);
    expect(out.match(/managed section >>>/g)).toHaveLength(1);
    expect(out.endsWith(SAMPLE)).toBe(true);
  });
});
