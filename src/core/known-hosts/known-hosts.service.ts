/** ~/.ssh/known_hosts: list, remove, scan and trust host keys. */

import fs from 'node:fs';
import { paths } from '../config/paths';
import { run } from '../utils/exec';
import { readText, writePrivate } from '../utils/fs-safe';
import { parsePublicKey } from '../keys/key-format';
import * as backups from '../backups/backup.service';
import type { KnownHostEntry, ScannedHostKey } from '../../shared/types';

// No leading "-": the host is passed to ssh-keygen / ssh-keyscan as an argument.
const HOST_RE = /^[A-Za-z0-9.:_[\]][A-Za-z0-9.:_\-[\]]*$/;

function assertHost(host: string): void {
  if (!HOST_RE.test(host)) throw new Error(`Invalid host: ${host}`);
}

function parseEntry(raw: string, line: number): KnownHostEntry | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const parts = trimmed.split(/\s+/);
  const marker = parts[0].startsWith('@') ? parts.shift()! : '';
  const hostsField = parts.shift() ?? '';
  const key = parsePublicKey(parts.join(' '));
  const hashed = hostsField.startsWith('|1|');
  return {
    line,
    marker,
    hashed,
    hosts: hashed ? [] : hostsField.split(','),
    hostsField,
    type: key?.type ?? 'unknown',
    fingerprint: key?.fingerprint ?? '',
    comment: key?.comment ?? '',
  };
}

export function list(): KnownHostEntry[] {
  return readText(paths.knownHosts)
    .split(/\r?\n/)
    .map((raw, i) => parseEntry(raw, i + 1))
    .filter((e): e is KnownHostEntry => e !== null);
}

/** Remove a single entry by 1-based line number (works for hashed entries too). */
export function removeLine(line: number, expectedFingerprint?: string): void {
  const text = readText(paths.knownHosts);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const entry = parseEntry(lines[line - 1] ?? '', line);
  if (!entry || (expectedFingerprint && entry.fingerprint !== expectedFingerprint)) {
    throw new Error('known_hosts changed on disk. Refresh and try again.');
  }
  backups.create('known_hosts', 'remove-entry');
  lines.splice(line - 1, 1);
  writePrivate(paths.knownHosts, lines.join(eol));
}

/** Remove every key for a host name, including hashed entries (`ssh-keygen -R`). */
export async function removeHost(host: string, port?: string | number): Promise<{ removed: boolean; output?: string }> {
  assertHost(host);
  if (!fs.existsSync(paths.knownHosts)) return { removed: false };
  backups.create('known_hosts', `remove-${host}`);
  const target = port && String(port) !== '22' ? `[${host}]:${port}` : host;
  const r = await run('ssh-keygen', ['-R', target, '-f', paths.knownHosts]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
  const output = (r.stdout + r.stderr).trim();
  return { removed: /updated/i.test(output), output };
}

/** Fetch a server's host keys without trusting them yet. */
export async function scan(host: string, port?: string | number): Promise<ScannedHostKey[]> {
  assertHost(host);
  const args = ['-T', '10'];
  if (port) args.push('-p', String(port));
  args.push(host);
  const r = await run('ssh-keyscan', args, { timeout: 20000 });
  const keys: ScannedHostKey[] = [];
  for (const raw of r.stdout.split(/\r?\n/)) {
    const entry = parseEntry(raw, 0);
    if (entry) keys.push({ raw: raw.trim(), ...entry });
  }
  if (!keys.length) throw new Error(`No host keys returned for ${host}. ${r.stderr.trim()}`);
  return keys;
}

/** Append scanned lines, skipping ones already present. */
export function trust(rawLines: string[]): { added: number } {
  const existing = new Set(
    readText(paths.knownHosts)
      .split(/\r?\n/)
      .map((l) => l.trim()),
  );
  const fresh = rawLines.map((l) => l.trim()).filter((l) => l && parseEntry(l, 0) && !existing.has(l));
  if (!fresh.length) return { added: 0 };
  backups.create('known_hosts', 'trust');
  let text = readText(paths.knownHosts);
  if (text && !text.endsWith('\n')) text += '\n';
  writePrivate(paths.knownHosts, text + fresh.join('\n') + '\n');
  return { added: fresh.length };
}
