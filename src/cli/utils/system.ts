/** Process-level helpers only the CLI needs (TTY passthrough, clipboard, detached launch). */

import { spawn, spawnSync } from 'node:child_process';

/** Run a command attached to the current terminal (for prompts like ssh-add). */
export function interactive(cmd: string, args: string[]): number {
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  if (r.error) throw r.error;
  return r.status ?? 1;
}

const CLIPBOARD_TOOLS: Record<string, [string, string[]][]> = {
  win32: [['clip', []]],
  darwin: [['pbcopy', []]],
  linux: [
    ['wl-copy', []],
    ['xclip', ['-selection', 'clipboard']],
    ['xsel', ['--clipboard', '--input']],
  ],
};

export function copyToClipboard(text: string): boolean {
  for (const [cmd, args] of CLIPBOARD_TOOLS[process.platform] ?? []) {
    const r = spawnSync(cmd, args, { input: text });
    if (!r.error && r.status === 0) return true;
  }
  return false;
}

export function detached(cmd: string, args: string[], env: Record<string, string | undefined> = {}): void {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', env: { ...process.env, ...env } });
  child.unref();
}
