import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { renderShims, SHIM_MARKER, type ShimTarget } from '../src/core/cli/shims';

const root = path.resolve(__dirname, '..');
const built = fs.existsSync(path.join(root, 'out', 'main', 'cli.js'));
const electronExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');

/** Write the shims to a folder with a space in its name and run `lanyard --version` through cmd.exe. */
function runShim(target: ShimTarget): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard shim '));
  try {
    const [shim] = renderShims(target, 'win32');
    const file = path.join(dir, shim.fileName);
    fs.writeFileSync(file, shim.content);
    return execFileSync('cmd.exe', ['/d', '/c', file, '--version'], { encoding: 'utf8' }).trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe.skipIf(process.platform !== 'win32' || !built)('Windows shims actually run', () => {
  const script = path.join(root, 'bin', 'lanyard.js');

  it('with node (source checkout)', () => {
    expect(runShim({ exe: 'node', script, runAsNode: false })).toBe('1.0.0');
  });

  it.skipIf(!fs.existsSync(electronExe))('with the app binary in Node mode (installed app)', () => {
    expect(runShim({ exe: electronExe, script, runAsNode: true })).toBe('1.0.0');
  });
});

describe('CLI launcher shims', () => {
  it('runs the packaged app binary as Node on Windows', () => {
    const [lanyard, lny] = renderShims({
      exe: 'C:\\Program Files\\Lanyard\\Lanyard.exe',
      script: 'C:\\Program Files\\Lanyard\\resources\\app.asar\\bin\\lanyard.js',
      runAsNode: true,
    }, 'win32');
    expect(lanyard.fileName).toBe('lanyard.cmd');
    expect(lny.fileName).toBe('lny.cmd');
    expect(lanyard.content).toContain(SHIM_MARKER);
    expect(lanyard.content).toContain('set "ELECTRON_RUN_AS_NODE=1"');
    expect(lanyard.content).toContain('"%LANYARD_APP_EXE%" "C:\\Program Files\\Lanyard\\resources\\app.asar\\bin\\lanyard.js" %*');
    expect(lanyard.content).toMatch(/\r\n$/);
  });

  it('uses node for a source checkout and quotes POSIX paths safely', () => {
    const [shim] = renderShims({ exe: 'node', script: "/home/o'neil/lanyard/bin/lanyard.js", runAsNode: false }, 'linux');
    expect(shim.fileName).toBe('lanyard');
    expect(shim.content.startsWith('#!/bin/sh\n')).toBe(true);
    expect(shim.content).toContain(`exec 'node' '/home/o'\\''neil/lanyard/bin/lanyard.js' "$@"`);
    expect(shim.content).not.toContain('ELECTRON_RUN_AS_NODE');
  });
});
