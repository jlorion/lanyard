'use strict';

/** ~/.ssh/known_hosts: list, remove, scan and trust host keys. */

const fs = require('fs');
const { paths } = require('../config/paths');
const { run } = require('../utils/exec');
const { readText, writePrivate } = require('../utils/fs-safe');
const { parsePublicKey } = require('../keys/key-format');
const backups = require('../backups/backup.service');

const HOST_RE = /^[A-Za-z0-9.:_\-[\]]+$/;

function parseEntry(raw, line) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const parts = trimmed.split(/\s+/);
  let marker = '';
  if (parts[0].startsWith('@')) marker = parts.shift();
  const hostsField = parts.shift() || '';
  const key = parsePublicKey(parts.join(' '));
  const hashed = hostsField.startsWith('|1|');
  return {
    line,
    marker,
    hashed,
    hosts: hashed ? [] : hostsField.split(','),
    hostsField,
    type: key ? key.type : 'unknown',
    fingerprint: key ? key.fingerprint : '',
    comment: key ? key.comment : '',
  };
}

function list() {
  return readText(paths.knownHosts)
    .split(/\r?\n/)
    .map((raw, i) => parseEntry(raw, i + 1))
    .filter(Boolean);
}

/** Remove a single entry by 1-based line number (works for hashed entries too). */
function removeLine(line, expectedFingerprint) {
  const text = readText(paths.knownHosts);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const entry = parseEntry(lines[line - 1] || '', line);
  if (!entry || (expectedFingerprint && entry.fingerprint !== expectedFingerprint)) {
    throw new Error('known_hosts changed on disk. Refresh and try again.');
  }
  backups.create('known_hosts', 'remove-entry');
  lines.splice(line - 1, 1);
  writePrivate(paths.knownHosts, lines.join(eol));
}

/** Remove every key for a host name, including hashed entries (`ssh-keygen -R`). */
async function removeHost(host, port) {
  if (!HOST_RE.test(host)) throw new Error(`Invalid host: ${host}`);
  if (!fs.existsSync(paths.knownHosts)) return { removed: false };
  backups.create('known_hosts', `remove-${host}`);
  const target = port && String(port) !== '22' ? `[${host}]:${port}` : host;
  const r = await run('ssh-keygen', ['-R', target, '-f', paths.knownHosts]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
  return { removed: /updated/i.test(r.stdout + r.stderr), output: (r.stdout + r.stderr).trim() };
}

/** Fetch a server's host keys without trusting them yet. */
async function scan(host, port) {
  if (!HOST_RE.test(host)) throw new Error(`Invalid host: ${host}`);
  const args = ['-T', '10'];
  if (port) args.push('-p', String(port));
  args.push(host);
  const r = await run('ssh-keyscan', args, { timeout: 20000 });
  const lines = r.stdout.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (!lines.length) throw new Error(`No host keys returned for ${host}. ${(r.stderr || '').trim()}`);
  return lines.map((raw) => ({ raw, ...parseEntry(raw, 0) }));
}

/** Append scanned lines, skipping ones already present. */
function trust(rawLines) {
  const existing = new Set(readText(paths.knownHosts).split(/\r?\n/).map((l) => l.trim()));
  const fresh = rawLines.map((l) => l.trim()).filter((l) => l && parseEntry(l, 0) && !existing.has(l));
  if (!fresh.length) return { added: 0 };
  backups.create('known_hosts', 'trust');
  let text = readText(paths.knownHosts);
  if (text && !text.endsWith('\n')) text += '\n';
  writePrivate(paths.knownHosts, text + fresh.join('\n') + '\n');
  return { added: fresh.length };
}

module.exports = { list, removeLine, removeHost, scan, trust };
