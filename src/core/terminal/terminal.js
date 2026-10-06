'use strict';

/**
 * Open a new terminal window running a command (e.g. `ssh myserver` or
 * `ssh-add <key>`) and leave it open after the command exits.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Arguments travel through cmd/PowerShell/sh/AppleScript, so shell
// metacharacters are rejected outright instead of being escaped per shell.
const UNSAFE = /[;&|<>^%"'`$\r\n]/;

function assertSafe(parts) {
  for (const p of parts) {
    if (typeof p !== 'string' || !p || UNSAFE.test(p)) throw new Error(`Refusing to run unsafe argument: ${p}`);
  }
}

function onPath(bin) {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  return (process.env.PATH || '').split(path.delimiter).some((dir) =>
    exts.some((ext) => {
      try {
        return fs.statSync(path.join(dir, bin + ext)).isFile();
      } catch {
        return false;
      }
    }));
}

function launch(cmd, args) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', () => {});
  child.unref();
}

const quoteSh = (s) => (/\s/.test(s) ? `'${s}'` : s);

function windows(preference, parts, title) {
  const hasWt = onPath('wt');
  const choice = preference === 'auto' ? (hasWt ? 'wt' : 'cmd') : preference;
  if (choice === 'wt' && hasWt) {
    return launch('wt.exe', ['new-tab', '--title', title, 'cmd.exe', '/k', ...parts]);
  }
  if (choice === 'powershell') {
    const ps = '& ' + parts.map((p) => `'${p}'`).join(' ');
    return launch('powershell.exe', ['-NoExit', '-Command', ps]);
  }
  // A detached console process gets its own console window on Windows.
  return launch('cmd.exe', ['/k', ...parts]);
}

function mac(preference, parts) {
  const app = preference === 'iterm' ? 'iTerm' : 'Terminal';
  const line = parts.map(quoteSh).join(' ');
  const script = app === 'iTerm'
    ? `tell application "iTerm" to create window with default profile command "${line}"`
    : `tell application "Terminal" to do script "${line}"`;
  return launch('osascript', ['-e', script, '-e', `tell application "${app}" to activate`]);
}

function linux(preference, parts) {
  const line = parts.map(quoteSh).join(' ') + '; exec $SHELL';
  const candidates = [
    ['x-terminal-emulator', ['-e', 'sh', '-c', line]],
    ['gnome-terminal', ['--', 'sh', '-c', line]],
    ['konsole', ['-e', 'sh', '-c', line]],
    ['xfce4-terminal', ['-x', 'sh', '-c', line]],
    ['alacritty', ['-e', 'sh', '-c', line]],
    ['kitty', ['sh', '-c', line]],
    ['xterm', ['-e', 'sh', '-c', line]],
  ];
  const preferred = candidates.find(([bin]) => bin === preference && onPath(bin));
  const found = preferred || candidates.find(([bin]) => onPath(bin));
  if (!found) throw new Error('No terminal emulator found. Set one in Settings.');
  return launch(found[0], found[1]);
}

/** Open `cmd args...` in a new terminal window. */
function openTerminal(cmd, args = [], { preference = 'auto', title = 'SSH Manager' } = {}) {
  const parts = [cmd, ...args];
  assertSafe(parts);
  if (process.platform === 'win32') return windows(preference, parts, title);
  if (process.platform === 'darwin') return mac(preference, parts);
  return linux(preference, parts);
}

const TERMINAL_CHOICES = {
  win32: ['auto', 'wt', 'cmd', 'powershell'],
  darwin: ['auto', 'terminal', 'iterm'],
  linux: ['auto', 'x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'alacritty', 'kitty', 'xterm'],
};

module.exports = { openTerminal, TERMINAL_CHOICES };
