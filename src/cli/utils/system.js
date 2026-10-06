'use strict';

/** Process-level helpers only the CLI needs (TTY passthrough, clipboard). */

const { spawn, spawnSync } = require('child_process');

/** Run a command attached to the current terminal (for prompts like ssh-add). */
function interactive(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

function copyToClipboard(text) {
  const candidates = {
    win32: [['clip', []]],
    darwin: [['pbcopy', []]],
    linux: [['wl-copy', []], ['xclip', ['-selection', 'clipboard']], ['xsel', ['--clipboard', '--input']]],
  }[process.platform] || [];
  for (const [cmd, args] of candidates) {
    const r = spawnSync(cmd, args, { input: text });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

/** Start a detached process (used to launch the desktop app). */
function detached(cmd, args, env) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', env: { ...process.env, ...env } });
  child.unref();
}

module.exports = { interactive, copyToClipboard, detached };
