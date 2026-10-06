/**
 * Launcher scripts that put `lanyard` and `lny` on the PATH. Each one runs
 * bin/lanyard.js either with the desktop app's own runtime (Electron in Node
 * mode, so no Node.js install is needed) or with `node` for a source checkout.
 */

export const SHIM_MARKER = 'Installed by Lanyard';
export const COMMAND_NAMES = ['lanyard', 'lny'] as const;

export interface ShimTarget {
  /** Lanyard executable (packaged app) or 'node' (source checkout). */
  exe: string;
  /** Absolute path of bin/lanyard.js (inside app.asar when packaged). */
  script: string;
  /** Run the app binary as Node (ELECTRON_RUN_AS_NODE). */
  runAsNode: boolean;
}

export interface Shim {
  fileName: string;
  content: string;
}

const shQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

function windowsShim(t: ShimTarget): string {
  const lines = ['@echo off', `rem ${SHIM_MARKER} (Settings > Command line). Safe to delete.`, 'setlocal'];
  if (t.runAsNode) {
    lines.push(`set "LANYARD_APP_EXE=${t.exe}"`, 'set "ELECTRON_RUN_AS_NODE=1"', `"%LANYARD_APP_EXE%" "${t.script}" %*`);
  } else {
    lines.push(`"${t.exe}" "${t.script}" %*`);
  }
  lines.push('exit /b %ERRORLEVEL%');
  return lines.join('\r\n') + '\r\n';
}

function posixShim(t: ShimTarget): string {
  const run = t.runAsNode
    ? `LANYARD_APP_EXE=${shQuote(t.exe)} ELECTRON_RUN_AS_NODE=1 exec ${shQuote(t.exe)} ${shQuote(t.script)} "$@"`
    : `exec ${shQuote(t.exe)} ${shQuote(t.script)} "$@"`;
  return ['#!/bin/sh', `# ${SHIM_MARKER} (Settings > Command line). Safe to delete.`, run, ''].join('\n');
}

export function renderShims(target: ShimTarget, platform: NodeJS.Platform = process.platform): Shim[] {
  const win = platform === 'win32';
  return COMMAND_NAMES.map((name) => ({
    fileName: win ? `${name}.cmd` : name,
    content: win ? windowsShim(target) : posixShim(target),
  }));
}
