/**
 * Open a new terminal window running a command (e.g. `ssh myserver` or
 * `ssh-add <key>`) and leave it open after the command exits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Arguments travel through cmd/PowerShell/sh/AppleScript, so shell
// metacharacters are rejected outright instead of being escaped per shell.
// PowerShell treats typographic quotes (U+2018-U+201E) like ASCII ones.
const UNSAFE = /[;&|<>^%"'`$\r\n\0\u2018-\u201e]/;

export const TERMINAL_CHOICES: Record<string, string[]> = {
  win32: ['auto', 'wt', 'cmd', 'powershell'],
  darwin: ['auto', 'terminal', 'iterm'],
  linux: ['auto', 'x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal', 'alacritty', 'kitty', 'xterm'],
};

export interface OpenTerminalOptions {
  preference?: string;
  title?: string;
}

function assertSafe(parts: string[]): void {
  for (const p of parts) {
    if (!p || UNSAFE.test(p)) throw new Error(`Refusing to run unsafe argument: ${p}`);
  }
}

function onPath(bin: string): boolean {
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', ''] : [''];
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) =>
    exts.some((ext) => {
      try {
        return fs.statSync(path.join(dir, bin + ext)).isFile();
      } catch {
        return false;
      }
    }),
  );
}

function launch(cmd: string, args: string[]): void {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false });
  child.on('error', () => {});
  child.unref();
}

const quoteSh = (s: string) => (/\s/.test(s) ? `'${s}'` : s);

function windows(preference: string, parts: string[], title: string): void {
  const hasWt = onPath('wt');
  const choice = preference === 'auto' ? (hasWt ? 'wt' : 'cmd') : preference;
  if (choice === 'wt' && hasWt) return launch('wt.exe', ['new-tab', '--title', title, 'cmd.exe', '/k', ...parts]);
  if (choice === 'powershell') {
    return launch('powershell.exe', ['-NoExit', '-Command', '& ' + parts.map((p) => `'${p}'`).join(' ')]);
  }
  // A detached console process gets its own console window on Windows.
  return launch('cmd.exe', ['/k', ...parts]);
}

function mac(preference: string, parts: string[]): void {
  const app = preference === 'iterm' ? 'iTerm' : 'Terminal';
  const line = parts.map(quoteSh).join(' ');
  const script =
    app === 'iTerm'
      ? `tell application "iTerm" to create window with default profile command "${line}"`
      : `tell application "Terminal" to do script "${line}"`;
  launch('osascript', ['-e', script, '-e', `tell application "${app}" to activate`]);
}

function linux(preference: string, parts: string[]): void {
  const line = parts.map(quoteSh).join(' ') + '; exec $SHELL';
  const candidates: [string, string[]][] = [
    ['x-terminal-emulator', ['-e', 'sh', '-c', line]],
    ['gnome-terminal', ['--', 'sh', '-c', line]],
    ['konsole', ['-e', 'sh', '-c', line]],
    ['xfce4-terminal', ['-x', 'sh', '-c', line]],
    ['alacritty', ['-e', 'sh', '-c', line]],
    ['kitty', ['sh', '-c', line]],
    ['xterm', ['-e', 'sh', '-c', line]],
  ];
  const found = candidates.find(([bin]) => bin === preference && onPath(bin)) ?? candidates.find(([bin]) => onPath(bin));
  if (!found) throw new Error('No terminal emulator found. Choose one in Settings.');
  launch(found[0], found[1]);
}

/** Open `cmd args...` in a new terminal window. */
export function openTerminal(cmd: string, args: string[] = [], { preference = 'auto', title = 'Lanyard' }: OpenTerminalOptions = {}): void {
  const parts = [cmd, ...args];
  assertSafe([...parts, title]);
  if (process.platform === 'win32') windows(preference, parts, title);
  else if (process.platform === 'darwin') mac(preference, parts);
  else linux(preference, parts);
}
