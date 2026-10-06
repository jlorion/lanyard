'use strict';

const fs = require('fs');
const path = require('path');

const isWin = process.platform === 'win32';

function ensureDir(dir, mode = 0o700) {
  fs.mkdirSync(dir, { recursive: true, mode });
}

function readText(file, fallback = '') {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * Write in place rather than write-and-rename: on Windows OpenSSH validates the
 * ACL of ~/.ssh/config and of private keys, and an in-place write keeps the
 * existing ACL / unix mode. New files are created private (0600).
 */
function writePrivate(file, content) {
  ensureDir(path.dirname(file));
  const exists = fs.existsSync(file);
  fs.writeFileSync(file, content, exists ? 'utf8' : { encoding: 'utf8', mode: 0o600 });
}

/** Atomic write for sshm's own files (state.json), where ACLs don't matter. */
function writeAtomic(file, content) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 23);
}

module.exports = { isWin, ensureDir, readText, writePrivate, writeAtomic, timestamp };
