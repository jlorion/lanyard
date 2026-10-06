/**
 * Puts `lanyard` and `lny` on the user's PATH without npm, the way VS Code
 * installs `code`. The Windows installer runs `Lanyard.exe --install-cli` and
 * the uninstaller `--uninstall-cli` (build/installer.nsh); on macOS / Linux,
 * where there is no installer step, Settings shows that command to run once.
 *
 *   Windows       %LOCALAPPDATA%\Lanyard\bin, added to the *user* PATH
 *   macOS/Linux   ~/.local/bin (the conventional per-user bin directory)
 *
 * Only files carrying SHIM_MARKER are ever overwritten or removed.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';
import { run } from '../core/utils/exec';
import { addToPathList, pathListHas, removeFromPathList } from '../core/utils/path-list';
import { COMMAND_NAMES, renderShims, SHIM_MARKER, type ShimTarget } from '../core/cli/shims';
import type { CliInstallStatus } from '../shared/ipc';

const isWin = process.platform === 'win32';

function binDir(): string {
  return isWin
    ? path.join(process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local'), 'Lanyard', 'bin')
    : path.join(os.homedir(), '.local', 'bin');
}

function shimTarget(): ShimTarget {
  if (app.isPackaged) {
    return { exe: process.execPath, script: path.join(process.resourcesPath, 'app.asar', 'bin', 'lanyard.js'), runAsNode: true };
  }
  // Source checkout: the CLI runs with the developer's Node.js.
  return { exe: 'node', script: path.join(app.getAppPath(), 'bin', 'lanyard.js'), runAsNode: false };
}

function ownedByLanyard(file: string): boolean {
  try {
    return fs.readFileSync(file, 'utf8').includes(SHIM_MARKER);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- Windows user PATH

async function readUserPath(): Promise<string> {
  const r = await run('reg', ['query', 'HKCU\\Environment', '/v', 'Path']);
  if (r.code !== 0) return '';
  const m = r.stdout.match(/^\s*Path\s+REG_(?:EXPAND_)?SZ\s+(.*)$/im);
  return m ? m[1].trim() : '';
}

/** Writes REG_EXPAND_SZ so entries like %USERPROFILE%\bin keep working. */
async function writeUserPath(value: string): Promise<void> {
  const r = await run('reg', ['add', 'HKCU\\Environment', '/v', 'Path', '/t', 'REG_EXPAND_SZ', '/d', value, '/f']);
  if (r.code !== 0) throw new Error(`Could not update your PATH: ${(r.stderr || r.stdout).trim()}`);
  await broadcastEnvironmentChange();
}

/** Tell Explorer the environment changed so new terminals pick up the PATH. */
async function broadcastEnvironmentChange(): Promise<void> {
  const script = [
    'Add-Type -Namespace Win32 -Name Env -MemberDefinition \'[DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern IntPtr SendMessageTimeout(IntPtr h, uint m, UIntPtr w, string l, uint f, uint t, out UIntPtr r);\';',
    '$r = [UIntPtr]::Zero;',
    '[void][Win32.Env]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, "Environment", 2, 5000, [ref]$r)',
  ].join(' ');
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000 }).catch(() => undefined);
}

// ---------------------------------------------------------------- public API

export async function status(): Promise<CliInstallStatus> {
  const dir = binDir();
  const shims = renderShims(shimTarget());
  const installed = shims.every((s) => ownedByLanyard(path.join(dir, s.fileName)));
  const onPath = isWin ? pathListHas(await readUserPath(), dir) : pathListHas(process.env.PATH ?? '', dir);
  return {
    installed,
    onPath,
    binDir: dir,
    commands: [...COMMAND_NAMES],
    pathHint: !isWin && !onPath ? `export PATH="$HOME/.local/bin:$PATH"` : undefined,
    packaged: app.isPackaged,
    installCommand: app.isPackaged ? `"${process.execPath}" --install-cli` : undefined,
  };
}

export async function install(): Promise<CliInstallStatus> {
  const dir = binDir();
  fs.mkdirSync(dir, { recursive: true });
  for (const shim of renderShims(shimTarget())) {
    const file = path.join(dir, shim.fileName);
    if (fs.existsSync(file) && !ownedByLanyard(file)) {
      throw new Error(`${file} already exists and was not installed by Lanyard; leaving it alone.`);
    }
    fs.writeFileSync(file, shim.content, { mode: 0o755 });
  }
  if (isWin) {
    const current = await readUserPath();
    if (!pathListHas(current, dir)) await writeUserPath(addToPathList(current, dir));
  }
  return status();
}

export async function uninstall(): Promise<CliInstallStatus> {
  const dir = binDir();
  for (const shim of renderShims(shimTarget())) {
    const file = path.join(dir, shim.fileName);
    if (ownedByLanyard(file)) fs.rmSync(file);
  }
  if (isWin) {
    const current = await readUserPath();
    if (pathListHas(current, dir)) await writeUserPath(removeFromPathList(current, dir));
    try {
      fs.rmdirSync(dir); // only succeeds when nothing else lives there
    } catch {
      // not empty or already gone
    }
  }
  return status();
}
