import { describe, expect, it } from 'vitest';
import { parseRemote, toAliasUrl } from '../src/core/git/remote-url';
import { isEncrypted, parsePublicKey } from '../src/core/keys/key-format';
import { BUILTIN_PROVIDERS, interpretTest } from '../src/core/providers';

const provider = (id: string) => BUILTIN_PROVIDERS.find((p) => p.id === id)!;
const result = (stdout: string, stderr = '', code = 0) => ({ code, stdout, stderr, timedOut: false });

describe('remote URL rewriting', () => {
  it('rewrites remotes to account aliases', () => {
    expect(toAliasUrl('https://github.com/acme/app', 'github.com-work')).toBe('git@github.com-work:acme/app.git');
    expect(toAliasUrl('git@github.com:acme/app.git', 'github.com-me')).toBe('git@github.com-me:acme/app.git');
    expect(toAliasUrl('ssh://git@gitlab.com:22/g/sub/p.git', 'gitlab.com-x')).toBe('git@gitlab.com-x:g/sub/p.git');
    expect(toAliasUrl('https://acme@dev.azure.com/acme/Proj/_git/repo', 'ssh.dev.azure.com-work'))
      .toBe('git@ssh.dev.azure.com-work:v3/acme/Proj/repo');
    expect(parseRemote('nonsense')).toBeNull();
  });
});

describe('key format', () => {
  it('parses public keys and fingerprints them like ssh-keygen', () => {
    const k = parsePublicKey('ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl you@example.com')!;
    expect(k.type).toBe('ED25519');
    expect(k.comment).toBe('you@example.com');
    expect(k.fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
    expect(isEncrypted('-----BEGIN RSA PRIVATE KEY-----\nProc-Type: 4,ENCRYPTED\n')).toBe(true);
  });
});

describe('provider greetings', () => {
  it('recognises successful logins and usernames', () => {
    const gh = interpretTest(provider('github'), result('', "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access.", 1));
    expect(gh).toMatchObject({ ok: true, username: 'octocat' });
    expect(interpretTest(provider('huggingface'), result('Hi julien, welcome to Hugging Face.')).username).toBe('julien');
  });

  it('treats anonymous / denied as failures', () => {
    expect(interpretTest(provider('huggingface'), result('Hi anonymous, welcome to Hugging Face.')).ok).toBe(false);
    expect(interpretTest(provider('gitlab'), result('', 'git@gitlab.com: Permission denied (publickey).', 255)).ok).toBe(false);
  });
});
