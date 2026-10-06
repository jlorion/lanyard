'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { toAliasUrl, parseRemote } = require('../src/core/git/remote-url');
const { parsePublicKey, isEncrypted } = require('../src/core/keys/key-format');
const { interpretTest, BUILTIN_PROVIDERS } = require('../src/core/providers');

const provider = (id) => BUILTIN_PROVIDERS.find((p) => p.id === id);

test('rewrites remotes to account aliases', () => {
  assert.equal(toAliasUrl('https://github.com/acme/app', 'github.com-work'), 'git@github.com-work:acme/app.git');
  assert.equal(toAliasUrl('git@github.com:acme/app.git', 'github.com-me'), 'git@github.com-me:acme/app.git');
  assert.equal(toAliasUrl('ssh://git@gitlab.com:22/g/sub/p.git', 'gitlab.com-x'), 'git@gitlab.com-x:g/sub/p.git');
  assert.equal(
    toAliasUrl('https://acme@dev.azure.com/acme/Proj/_git/repo', 'ssh.dev.azure.com-work'),
    'git@ssh.dev.azure.com-work:v3/acme/Proj/repo',
  );
  assert.equal(parseRemote('nonsense'), null);
});

test('parses public keys and fingerprints them like ssh-keygen', () => {
  const k = parsePublicKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl you@example.com');
  assert.equal(k.type, 'ED25519');
  assert.equal(k.comment, 'you@example.com');
  assert.match(k.fingerprint, /^SHA256:[A-Za-z0-9+/]{43}$/);
  assert.equal(isEncrypted('-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\n'), true);
});

test('interprets provider greetings', () => {
  const gh = interpretTest(provider('github'), { code: 1, stdout: '', stderr: "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access." });
  assert.equal(gh.ok, true);
  assert.equal(gh.username, 'octocat');

  const hfAnon = interpretTest(provider('huggingface'), { code: 0, stdout: 'Hi anonymous, welcome to Hugging Face.', stderr: '' });
  assert.equal(hfAnon.ok, false);

  const hf = interpretTest(provider('huggingface'), { code: 0, stdout: 'Hi julien, welcome to Hugging Face.', stderr: '' });
  assert.equal(hf.username, 'julien');

  const denied = interpretTest(provider('gitlab'), { code: 255, stdout: '', stderr: 'git@gitlab.com: Permission denied (publickey).' });
  assert.equal(denied.ok, false);
});
