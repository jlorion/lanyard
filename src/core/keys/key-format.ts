/** Pure helpers for OpenSSH key material - no file system or process access. */

import crypto from 'node:crypto';

const KEY_TYPES: Record<string, string> = {
  'ssh-ed25519': 'ED25519',
  'ssh-rsa': 'RSA',
  'ecdsa-sha2-nistp256': 'ECDSA',
  'ecdsa-sha2-nistp384': 'ECDSA',
  'ecdsa-sha2-nistp521': 'ECDSA',
  'sk-ssh-ed25519@openssh.com': 'ED25519-SK',
  'sk-ecdsa-sha2-nistp256@openssh.com': 'ECDSA-SK',
  'ssh-dss': 'DSA',
};

export interface PublicKey {
  algorithm: string;
  type: string;
  blob: string;
  comment: string;
  fingerprint: string;
}

/** SHA256 fingerprint in the same format as `ssh-keygen -lf`. */
export function fingerprint(base64Blob: string): string {
  const digest = crypto.createHash('sha256').update(Buffer.from(base64Blob, 'base64')).digest('base64');
  return 'SHA256:' + digest.replace(/=+$/, '');
}

/** Parse a single public key line: "<type> <base64> [comment]". */
export function parsePublicKey(line: string | null | undefined): PublicKey | null {
  const parts = String(line ?? '')
    .trim()
    .split(/\s+/);
  if (parts.length < 2 || !/^[A-Za-z0-9+/=]+$/.test(parts[1])) return null;
  return {
    algorithm: parts[0],
    type: KEY_TYPES[parts[0]] ?? parts[0],
    blob: parts[1],
    comment: parts.slice(2).join(' '),
    fingerprint: fingerprint(parts[1]),
  };
}

/**
 * Detect passphrase protection without spawning ssh-keygen. The OpenSSH format
 * stores the cipher name right after the "openssh-key-v1\0" magic.
 */
export function isEncrypted(privateKeyText: string | null | undefined): boolean {
  const text = String(privateKeyText ?? '');
  if (/ENCRYPTED/.test(text)) return true; // PEM: Proc-Type: 4,ENCRYPTED / BEGIN ENCRYPTED PRIVATE KEY
  const m = text.match(/-----BEGIN OPENSSH PRIVATE KEY-----([\s\S]+?)-----END OPENSSH PRIVATE KEY-----/);
  if (!m) return false;
  const buf = Buffer.from(m[1].replace(/\s+/g, ''), 'base64');
  const magic = 'openssh-key-v1\0';
  if (buf.toString('latin1', 0, magic.length) !== magic) return false;
  const len = buf.readUInt32BE(magic.length);
  const cipher = buf.toString('latin1', magic.length + 4, magic.length + 4 + len);
  return cipher !== 'none';
}

export function looksLikePrivateKey(text: string | null | undefined): boolean {
  return /-----BEGIN (OPENSSH|RSA|EC|DSA|ENCRYPTED)? ?PRIVATE KEY-----/.test(String(text ?? ''));
}
