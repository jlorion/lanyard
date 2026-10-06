'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const sshConfig = require('../src/core/ssh-config');

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

test('round-trips untouched content byte for byte', () => {
  assert.equal(sshConfig.serialize(sshConfig.parse(SAMPLE)), SAMPLE);
  const crlf = SAMPLE.replace(/\n/g, '\r\n');
  assert.equal(sshConfig.serialize(sshConfig.parse(crlf)), crlf);
});

test('lists hosts with leading comments', () => {
  const hosts = sshConfig.listHosts(sshConfig.parse(SAMPLE));
  assert.equal(hosts.length, 2);
  assert.equal(hosts[0].alias, 'work');
  assert.equal(hosts[0].comment, 'work server');
  assert.equal(hosts[0].port, '2222');
  assert.equal(hosts[1].isPattern, true);
});

test('updates in place, keeps comments, appends new options', () => {
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
  assert.match(out, /  HostName 10\.0\.0\.6\n/);
  assert.doesNotMatch(out, /User deploy/);
  assert.match(out, /# keep this comment/);
  assert.match(out, /  IdentityFile "~\/\.ssh\/my key"\n\nHost \*/);
});

test('adds new hosts before a trailing Host *', () => {
  const model = sshConfig.parse(SAMPLE);
  sshConfig.addHost(model, { patterns: 'db', options: [{ key: 'HostName', value: 'db.local' }] });
  const hosts = sshConfig.listHosts(model);
  assert.deepEqual(hosts.map((h) => h.alias), ['work', 'db', '*']);
});

test('detects stale edits', () => {
  const model = sshConfig.parse(SAMPLE);
  assert.throws(() => sshConfig.removeHost(model, 0, 'not-work'), /changed on disk/);
});

test('managed section is placed on top and replaced on re-render', () => {
  const model = sshConfig.parse(SAMPLE);
  model.managedLines = sshConfig.renderManaged([
    { comment: 'GitHub', patterns: 'github.com', options: [{ key: 'IdentityFile', value: '~/.ssh/a' }] },
  ]);
  const once = sshConfig.serialize(model);
  assert.ok(once.startsWith(sshConfig.MANAGED_BEGIN));
  assert.match(once, /Host \*\n# <<< sshm managed section <<<\n\n# my config/);

  const again = sshConfig.parse(once);
  assert.equal(sshConfig.serialize(again), once);
  const hosts = sshConfig.listHosts(again);
  assert.equal(hosts[0].managed, true);
  assert.equal(hosts.filter((h) => h.managed).length, 1, 'terminator Host * is hidden');

  again.managedLines = [];
  assert.equal(sshConfig.serialize(again), SAMPLE);
});
