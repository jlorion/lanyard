'use strict';

/** SSH key pairs in ~/.ssh: listing, generation, passphrases, removal, permissions. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { paths, expandTilde, toTilde } = require('../config/paths');
const { run } = require('../utils/exec');
const { ensureDir, isWin, timestamp } = require('../utils/fs-safe');
const { parsePublicKey, isEncrypted, looksLikePrivateKey } = require('./key-format');

const NOT_KEYS = /^(config|known_hosts|authorized_keys|environment|rc)(\..*)?$|\.(bak|old|tmp|txt|md|json|log)$/i;
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const KEY_GEN_TYPES = ['ed25519', 'rsa', 'ecdsa'];

function readSafe(file, max = 64 * 1024) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > max) return null;
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function describe(privatePath, publicPath) {
  const privText = privatePath ? readSafe(privatePath) : null;
  const pub = publicPath ? parsePublicKey(readSafe(publicPath)) : null;
  const ref = privatePath || publicPath;
  const stat = fs.statSync(ref);
  return {
    name: path.basename(privatePath || publicPath.replace(/\.pub$/, '')),
    path: privatePath || null,
    tildePath: toTilde(privatePath || publicPath.replace(/\.pub$/, '')),
    publicPath: publicPath || null,
    hasPrivate: !!privatePath,
    type: pub ? pub.type : 'unknown',
    algorithm: pub ? pub.algorithm : '',
    fingerprint: pub ? pub.fingerprint : '',
    comment: pub ? pub.comment : '',
    encrypted: privText ? isEncrypted(privText) : false,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function list() {
  const dir = paths.sshDir;
  if (!fs.existsSync(dir)) return [];
  const files = new Set(fs.readdirSync(dir));
  const keys = [];
  for (const f of files) {
    if (NOT_KEYS.test(f)) continue;
    const full = path.join(dir, f);
    if (f.endsWith('.pub')) {
      if (!files.has(f.slice(0, -4))) keys.push(describe(null, full)); // public half only
      continue;
    }
    const hasPub = files.has(f + '.pub');
    if (hasPub || looksLikePrivateKey(readSafe(full))) {
      keys.push(describe(full, hasPub ? full + '.pub' : null));
    }
  }
  return keys.sort((a, b) => a.name.localeCompare(b.name));
}

/** Accept a bare key name ("id_ed25519"), a "~/..." path or an absolute path. */
function resolve(ref) {
  if (!ref) throw new Error('Key reference is required.');
  const candidate = /[\\/~]/.test(ref) ? path.resolve(expandTilde(ref)) : path.join(paths.sshDir, ref);
  const priv = candidate.replace(/\.pub$/, '');
  if (!fs.existsSync(priv) && !fs.existsSync(priv + '.pub')) throw new Error(`Key not found: ${ref}`);
  return priv;
}

function get(ref) {
  const priv = resolve(ref);
  return describe(fs.existsSync(priv) ? priv : null, fs.existsSync(priv + '.pub') ? priv + '.pub' : null);
}

async function publicKey(ref) {
  const priv = resolve(ref);
  if (fs.existsSync(priv + '.pub')) return fs.readFileSync(priv + '.pub', 'utf8').trim();
  // Derive it from the private key (only works for unencrypted keys).
  const r = await run('ssh-keygen', ['-y', '-P', '', '-f', priv]);
  if (r.code !== 0) throw new Error(`Could not derive public key: ${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

async function generate({ name, type = 'ed25519', bits, comment = '', passphrase = '' }) {
  if (!NAME_RE.test(name || '')) throw new Error('Key file name may only contain letters, digits, ".", "_" and "-".');
  if (!KEY_GEN_TYPES.includes(type)) throw new Error(`Unsupported key type "${type}". Use one of: ${KEY_GEN_TYPES.join(', ')}`);
  ensureDir(paths.sshDir);
  const file = path.join(paths.sshDir, name);
  if (fs.existsSync(file) || fs.existsSync(file + '.pub')) throw new Error(`A key named "${name}" already exists.`);

  const args = ['-t', type, '-f', file, '-N', passphrase, '-C', comment, '-q'];
  if (type === 'rsa') args.push('-b', String(bits || 4096));
  if (type === 'ecdsa') args.push('-b', String(bits || 521));
  const r = await run('ssh-keygen', args, { timeout: 120000 });
  if (r.code !== 0) throw new Error(`ssh-keygen failed: ${(r.stderr || r.stdout).trim()}`);
  return get(file);
}

async function changePassphrase(ref, oldPassphrase = '', newPassphrase = '') {
  const priv = resolve(ref);
  const r = await run('ssh-keygen', ['-p', '-f', priv, '-P', oldPassphrase, '-N', newPassphrase]);
  if (r.code !== 0) throw new Error(`Could not change passphrase: ${(r.stderr || r.stdout).trim()}`);
  return get(priv);
}

/** Moves the key pair to ~/.sshm/trash/<timestamp>/ instead of deleting it. */
function remove(ref) {
  const priv = resolve(ref);
  const dest = path.join(paths.trash, timestamp());
  ensureDir(dest);
  const moved = [];
  for (const f of [priv, priv + '.pub']) {
    if (!fs.existsSync(f)) continue;
    const target = path.join(dest, path.basename(f));
    fs.copyFileSync(f, target);
    fs.rmSync(f);
    moved.push(target);
  }
  return { trashDir: dest, moved };
}

/** Restrict a private key to the current user (OpenSSH refuses world-readable keys). */
async function fixPermissions(ref) {
  const priv = resolve(ref);
  if (!isWin) {
    fs.chmodSync(priv, 0o600);
    return { ok: true, message: 'chmod 600 applied.' };
  }
  const user = `${os.userInfo().username}:F`;
  const r = await run('icacls', [priv, '/inheritance:r', '/grant:r', user]);
  if (r.code !== 0) throw new Error(`icacls failed: ${(r.stderr || r.stdout).trim()}`);
  return { ok: true, message: `Access restricted to ${os.userInfo().username}.` };
}

module.exports = { KEY_GEN_TYPES, list, resolve, get, publicKey, generate, changePassphrase, remove, fixPermissions };
