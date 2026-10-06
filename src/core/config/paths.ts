import os from 'node:os';
import path from 'node:path';
import type { LanyardPaths } from '../../shared/types';

export const HOME = os.homedir();

// Both directories can be overridden through env vars, which keeps tests (and
// experiments) away from the real ~/.ssh. The SSHM_* names predate the rename.
const sshDir = (): string => process.env.LANYARD_SSH_DIR || process.env.SSHM_SSH_DIR || path.join(HOME, '.ssh');
const dataDir = (): string => process.env.LANYARD_HOME || process.env.SSHM_HOME || path.join(HOME, '.lanyard');

/** Data directory used before the app was renamed to Lanyard. */
export const LEGACY_DATA_DIR = path.join(HOME, '.sshm');

/** True when the data directory comes from an env override (tests, sandboxes). */
export function dataDirOverridden(): boolean {
  return !!(process.env.LANYARD_HOME || process.env.SSHM_HOME);
}

export const paths = {
  get sshDir() { return sshDir(); },
  get config() { return path.join(sshDir(), 'config'); },
  get knownHosts() { return path.join(sshDir(), 'known_hosts'); },
  get dataDir() { return dataDir(); },
  get state() { return path.join(dataDir(), 'state.json'); },
  get backups() { return path.join(dataDir(), 'backups'); },
  get trash() { return path.join(dataDir(), 'trash'); },
};

export function describePaths(): LanyardPaths {
  return {
    sshDir: paths.sshDir,
    config: paths.config,
    knownHosts: paths.knownHosts,
    dataDir: paths.dataDir,
    backups: paths.backups,
  };
}

/** Expand a leading "~" to the home directory. */
export function expandTilde(p: string): string {
  if (p === '~') return HOME;
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(HOME, p.slice(2));
  return p;
}

/**
 * Turn a path into the "~/..." form with forward slashes, which is what
 * ssh_config expects and what both Windows OpenSSH and Git's ssh accept.
 */
export function toTilde(p: string): string {
  const abs = path.resolve(expandTilde(p));
  const rel = path.relative(HOME, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return ('~/' + rel).replace(/\\/g, '/');
  return abs.replace(/\\/g, '/');
}

/** Compare two paths that may use different spellings ("~", quotes, case on Windows). */
export function samePath(a: string, b: string): boolean {
  if (!a || !b) return false;
  const norm = (p: string) => {
    const r = path.resolve(expandTilde(p.replace(/^"|"$/g, '')));
    return process.platform === 'win32' ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
}
