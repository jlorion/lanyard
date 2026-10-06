'use strict';

/** ssh-agent access through ssh-add. */

const { run } = require('../utils/exec');
const { isWin } = require('../utils/fs-safe');
const keys = require('../keys/keys.service');

const NOT_RUNNING_HINT = isWin
  ? 'The OpenSSH Authentication Agent service is not running. In an elevated PowerShell run: '
    + 'Get-Service ssh-agent | Set-Service -StartupType Automatic; Start-Service ssh-agent'
  : 'No agent found. Start one with: eval "$(ssh-agent -s)"';

async function status() {
  let r;
  try {
    r = await run('ssh-add', ['-l']);
  } catch (err) {
    return { running: false, identities: [], message: err.message };
  }
  // ssh-add -l exits 0 with keys, 1 when the agent is empty, 2 when unreachable.
  if (r.code === 2 || /could not open a connection|error connecting to agent/i.test(r.stderr)) {
    return { running: false, identities: [], message: NOT_RUNNING_HINT };
  }
  const identities = r.stdout.split(/\r?\n/)
    .map((l) => l.match(/^(\d+)\s+(\S+)\s+(.*?)\s+\(([^)]+)\)\s*$/))
    .filter(Boolean)
    .map((m) => ({ bits: Number(m[1]), fingerprint: m[2], comment: m[3], type: m[4] }));
  return { running: true, identities, message: identities.length ? '' : 'The agent has no identities.' };
}

/**
 * Command that adds a key with an interactive passphrase prompt. The CLI runs
 * it with an inherited TTY; the desktop app opens it in a terminal window.
 */
function interactiveAddCommand(ref) {
  const key = keys.get(ref);
  if (!key.path) throw new Error('Only the public half of this key exists.');
  return { cmd: 'ssh-add', args: [key.path] };
}

/** Add an unencrypted key non-interactively. */
async function add(ref) {
  const key = keys.get(ref);
  if (!key.path) throw new Error('Only the public half of this key exists.');
  if (key.encrypted) {
    const err = new Error('This key is passphrase-protected; it must be added from a terminal.');
    err.code = 'NEEDS_PASSPHRASE';
    throw err;
  }
  const r = await run('ssh-add', [key.path], { timeout: 15000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add failed');
  return { added: key.name };
}

async function remove(ref) {
  const key = keys.get(ref);
  const target = key.publicPath || key.path;
  const r = await run('ssh-add', ['-d', target]);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add -d failed');
  return { removed: key.name };
}

async function clear() {
  const r = await run('ssh-add', ['-D']);
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim() || 'ssh-add -D failed');
  return { cleared: true };
}

module.exports = { status, add, interactiveAddCommand, remove, clear };
