'use strict';

/** Reads and writes ~/.ssh/config, taking a backup before every change. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { paths } = require('../config/paths');
const { readText, writePrivate } = require('../utils/fs-safe');
const { run } = require('../utils/exec');
const backups = require('../backups/backup.service');
const state = require('../state/store');
const { parse, serialize } = require('./parser');

function readRaw() {
  return readText(paths.config);
}

function load() {
  return parse(readRaw());
}

/** Write raw text if it differs from what's on disk. Returns true when written. */
function writeRaw(text, reason) {
  if (text === readRaw()) return false;
  backups.create('config', reason, state.load().settings.backupLimit);
  writePrivate(paths.config, text);
  return true;
}

function save(model, reason) {
  return writeRaw(serialize(model), reason);
}

/**
 * Ask OpenSSH itself whether a config parses (`ssh -G -F <file>`). Returns
 * { ok: true } when ssh is unavailable so validation never blocks saving.
 */
async function validate(text) {
  const tmp = path.join(os.tmpdir(), `sshm-validate-${process.pid}-${Date.now()}.conf`);
  fs.writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
  try {
    const r = await run('ssh', ['-G', '-F', tmp, 'sshm-validate-probe'], { timeout: 10000 });
    if (r.code === 0) return { ok: true };
    const error = (r.stderr || r.stdout).trim().split(/\r?\n/)
      .filter((l) => !/terminating|^\s*$/.test(l))
      .join('\n')
      .replaceAll(tmp, 'config');
    return { ok: false, error: error || `ssh exited with code ${r.code}` };
  } catch {
    return { ok: true, skipped: true };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

module.exports = { readRaw, load, writeRaw, save, validate };
