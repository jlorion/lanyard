/** Versions of the external tools Lanyard drives (for About / bug reports). */

import { run } from './exec';

async function firstLine(cmd: string, args: string[]): Promise<string | null> {
  try {
    const r = await run(cmd, args, { timeout: 5000 });
    // `ssh -V` prints to stderr; most tools use stdout.
    const line = `${r.stdout}\n${r.stderr}`.split(/\r?\n/).find((l) => l.trim());
    return line ? line.trim() : null;
  } catch {
    return null; // not installed / not on PATH
  }
}

export async function toolVersions(): Promise<{ ssh: string | null; git: string | null }> {
  const [ssh, git] = await Promise.all([firstLine('ssh', ['-V']), firstLine('git', ['--version'])]);
  return { ssh, git };
}
