import fs from 'node:fs';
import path from 'node:path';

export const isWin = process.platform === 'win32';

export function ensureDir(dir: string, mode = 0o700): void {
  fs.mkdirSync(dir, { recursive: true, mode });
}

export function readText(file: string, fallback = ''): string {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
}

/**
 * Write in place rather than write-and-rename: on Windows OpenSSH validates the
 * ACL of ~/.ssh/config and of private keys, and an in-place write keeps the
 * existing ACL / unix mode. New files are created private (0600).
 */
export function writePrivate(file: string, content: string): void {
  ensureDir(path.dirname(file));
  if (fs.existsSync(file)) fs.writeFileSync(file, content, 'utf8');
  else fs.writeFileSync(file, content, { encoding: 'utf8', mode: 0o600 });
}

/** Atomic write for Lanyard's own files (state.json), where ACLs don't matter. */
export function writeAtomic(file: string, content: string): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

/** Sortable, filename-safe timestamp, e.g. 2026-10-06_12-04-29-545. */
export function timestamp(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 23);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
