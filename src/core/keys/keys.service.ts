/** SSH key pairs in ~/.ssh: listing, generation, passphrases, removal, permissions. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paths, expandTilde, toTilde, samePath } from '../config/paths';
import { run } from '../utils/exec';
import { ensureDir, isWin, timestamp } from '../utils/fs-safe';
import { parsePublicKey, isEncrypted, looksLikePrivateKey } from './key-format';
import type { GenerateKeyInput, KeyInfo, KeyNameCheck, KeyType, TrashResult } from '../../shared/types';

const NOT_KEYS = /^(config|known_hosts|authorized_keys|environment|rc)(\..*)?$|\.(bak|old|tmp|txt|md|json|log)$/i;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const KEY_GEN_TYPES: KeyType[] = ['ed25519', 'rsa', 'ecdsa'];

function readSafe(file: string, max = 64 * 1024): string | null {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > max) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function describe(privatePath: string | null, publicPath: string | null): KeyInfo {
  const base = privatePath ?? publicPath!.replace(/\.pub$/, '');
  const pub = publicPath ? parsePublicKey(readSafe(publicPath)) : null;
  const privText = privatePath ? readSafe(privatePath) : null;
  return {
    name: path.basename(base),
    path: privatePath,
    tildePath: toTilde(base),
    publicPath,
    hasPrivate: !!privatePath,
    type: pub?.type ?? 'unknown',
    algorithm: pub?.algorithm ?? '',
    fingerprint: pub?.fingerprint ?? '',
    comment: pub?.comment ?? '',
    encrypted: isEncrypted(privText),
    modifiedAt: fs.statSync(privatePath ?? publicPath!).mtime.toISOString(),
  };
}

export function list(): KeyInfo[] {
  const dir = paths.sshDir;
  if (!fs.existsSync(dir)) return [];
  const files = new Set(fs.readdirSync(dir));
  const keys: KeyInfo[] = [];
  for (const f of files) {
    if (NOT_KEYS.test(f)) continue;
    const full = path.join(dir, f);
    if (f.endsWith('.pub')) {
      if (!files.has(f.slice(0, -4))) keys.push(describe(null, full)); // public half only
      continue;
    }
    const hasPub = files.has(f + '.pub');
    if (hasPub || looksLikePrivateKey(readSafe(full))) keys.push(describe(full, hasPub ? full + '.pub' : null));
  }
  return keys.sort((a, b) => a.name.localeCompare(b.name));
}

/** Accept a bare key name ("id_ed25519"), a "~/..." path or an absolute path. */
export function resolve(ref: string): string {
  if (!ref) throw new Error('Key reference is required.');
  const candidate = /[\\/~]/.test(ref) ? path.resolve(expandTilde(ref.replace(/^"|"$/g, ''))) : path.join(paths.sshDir, ref);
  const priv = candidate.replace(/\.pub$/, '');
  if (!fs.existsSync(priv) && !fs.existsSync(priv + '.pub')) throw new Error(`Key not found: ${ref}`);
  return priv;
}

/** Does an IdentityFile value (any spelling: ~, quotes, slashes, case on Windows) point at this key? */
export function isKeyAt(key: KeyInfo, identityFile: string): boolean {
  return !!identityFile && !!key.path && samePath(key.path, identityFile);
}

/** Normalise a key reference for ssh_config ("~/.ssh/name") when the file exists. */
export function configPath(ref: string): string {
  try {
    return toTilde(resolve(ref));
  } catch {
    return ref;
  }
}

/** Feed answers to ssh-keygen's passphrase prompts (see run's noTty). */
function passphraseInput(answers: string[]) {
  return { input: answers.map((a) => `${a}\n`).join(''), noTty: true, env: { SSH_ASKPASS_REQUIRE: 'never' } };
}

/**
 * How passphrases reach ssh-keygen. On Linux and macOS any local user can read
 * a process's arguments, so they are typed into its prompts through stdin.
 * Windows OpenSSH reads prompts from the console only and never from stdin
 * (it would wait forever), but there a process's command line is readable
 * only by its owner and administrators, so the -P / -N options are used.
 */
function passphraseOptions(oldPassphrase: string | null, newPassphrase: string) {
  if (isWin) {
    const args = oldPassphrase == null ? [] : ['-P', oldPassphrase];
    return { args: [...args, '-N', newPassphrase], run: {} };
  }
  const answers = oldPassphrase == null ? [] : [oldPassphrase];
  return { args: [], run: passphraseInput([...answers, newPassphrase, newPassphrase]) };
}

/**
 * Key references may be absolute paths, so operations that move or re-permission
 * files first make sure the target really is a key: a private key file, or a
 * file with a matching .pub next to it. Anything else is refused.
 */
function assertKeyFile(priv: string): string {
  const isPrivateKey = fs.existsSync(priv) && fs.statSync(priv).isFile() && looksLikePrivateKey(readSafe(priv));
  const isPublicOnly = !fs.existsSync(priv) && fs.existsSync(priv + '.pub') && !!parsePublicKey(readSafe(priv + '.pub') ?? '');
  if (!isPrivateKey && !isPublicOnly) throw new Error(`Not an SSH key: ${toTilde(priv)}`);
  return priv;
}

export function get(ref: string): KeyInfo {
  const priv = resolve(ref);
  return describe(fs.existsSync(priv) ? priv : null, fs.existsSync(priv + '.pub') ? priv + '.pub' : null);
}

export async function publicKey(ref: string): Promise<string> {
  const priv = resolve(ref);
  if (fs.existsSync(priv + '.pub')) return fs.readFileSync(priv + '.pub', 'utf8').trim();
  // Derive it from the private key (only works for unencrypted keys).
  const r = await run('ssh-keygen', ['-y', '-P', '', '-f', priv]);
  if (r.code !== 0) throw new Error(`Could not derive public key: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

/**
 * Can `name` be used for a new key in ~/.ssh? Checks the format and whether
 * the private or public file already exists, and suggests a free alternative.
 */
export function checkName(name: string): KeyNameCheck {
  if (!name) return { valid: false, exists: false, message: 'Enter a file name.' };
  if (!NAME_RE.test(name)) {
    return { valid: false, exists: false, message: 'Use letters, digits, ".", "_" and "-" (start with a letter or digit).' };
  }
  const taken = (n: string) => fs.existsSync(path.join(paths.sshDir, n)) || fs.existsSync(path.join(paths.sshDir, `${n}.pub`));
  if (!taken(name)) return { valid: true, exists: false };
  let i = 2;
  while (taken(`${name}_${i}`)) i++;
  return { valid: true, exists: true, suggestion: `${name}_${i}`, message: `~/.ssh/${name} already exists.` };
}

export async function generate({ name, type = 'ed25519', bits, comment = '', passphrase = '' }: GenerateKeyInput): Promise<KeyInfo> {
  if (!NAME_RE.test(name || '')) throw new Error('Key file name may only contain letters, digits, ".", "_" and "-".');
  if (!KEY_GEN_TYPES.includes(type)) throw new Error(`Unsupported key type "${type}". Use one of: ${KEY_GEN_TYPES.join(', ')}`);
  ensureDir(paths.sshDir);
  const file = path.join(paths.sshDir, name);
  if (fs.existsSync(file) || fs.existsSync(file + '.pub')) throw new Error(`A key named "${name}" already exists.`);

  const args = ['-t', type, '-f', file, '-C', comment, '-q'];
  if (type === 'rsa') args.push('-b', String(bits || 4096));
  if (type === 'ecdsa') args.push('-b', String(bits || 521));
  // An empty passphrase is no secret, so -N '' is fine on every platform.
  const pass = passphrase ? passphraseOptions(null, passphrase) : { args: ['-N', ''], run: {} };
  const r = await run('ssh-keygen', [...args, ...pass.args], { timeout: 120000, ...pass.run });
  if (r.code !== 0) throw new Error(`ssh-keygen failed: ${(r.stderr || r.stdout).trim()}`);
  return get(file);
}

export async function changePassphrase(ref: string, oldPassphrase = '', newPassphrase = ''): Promise<KeyInfo> {
  const priv = assertKeyFile(resolve(ref));
  // ssh-keygen -p asks for the old passphrase only when the key has one.
  const old = isEncrypted(fs.readFileSync(priv, 'utf8')) ? oldPassphrase : null;
  const pass = passphraseOptions(old, newPassphrase);
  const r = await run('ssh-keygen', ['-p', ...pass.args, '-f', priv], pass.run);
  if (r.code !== 0) throw new Error(`Could not change passphrase: ${(r.stderr || r.stdout).trim()}`);
  return get(priv);
}

/** Moves the key pair to ~/.lanyard/trash/<timestamp>/ instead of deleting it. */
export function remove(ref: string): TrashResult {
  const priv = assertKeyFile(resolve(ref));
  const trashDir = path.join(paths.trash, timestamp());
  ensureDir(trashDir);
  const moved: string[] = [];
  for (const f of [priv, priv + '.pub']) {
    if (!fs.existsSync(f)) continue;
    const target = path.join(trashDir, path.basename(f));
    fs.copyFileSync(f, target);
    fs.rmSync(f);
    moved.push(target);
  }
  return { trashDir, moved };
}

/** Restrict a private key to the current user (OpenSSH refuses world-readable keys). */
export async function fixPermissions(ref: string): Promise<{ message: string }> {
  const priv = assertKeyFile(resolve(ref));
  if (!isWin) {
    fs.chmodSync(priv, 0o600);
    return { message: 'chmod 600 applied.' };
  }
  const user = os.userInfo().username;
  const r = await run('icacls', [priv, '/inheritance:r', '/grant:r', `${user}:F`]);
  if (r.code !== 0) throw new Error(`icacls failed: ${(r.stderr || r.stdout).trim()}`);
  return { message: `Access restricted to ${user}.` };
}
