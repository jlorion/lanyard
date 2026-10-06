/**
 * Snapshots of ~/.ssh/config and known_hosts taken before every write, stored
 * in ~/.lanyard/backups as "<kind>_<timestamp>[_<reason>].bak".
 */

import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../config/paths';
import { ensureDir, readText, writePrivate, timestamp } from '../utils/fs-safe';
import type { BackupInfo, BackupKind } from '../../shared/types';

const TARGETS: Record<BackupKind, () => string> = {
  config: () => paths.config,
  known_hosts: () => paths.knownHosts,
};

const NAME_RE = /^(config|known_hosts)_(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)-(\d\d)(?:-\d{3})?(?:_(.*))?\.bak$/;

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

export function list(kind?: BackupKind): BackupInfo[] {
  if (!fs.existsSync(paths.backups)) return [];
  return fs
    .readdirSync(paths.backups)
    .filter((f) => f.endsWith('.bak') && (!kind || f.startsWith(kind + '_')))
    .map((f): BackupInfo => {
      const m = f.match(NAME_RE);
      const stat = fs.statSync(path.join(paths.backups, f));
      return {
        id: f,
        kind: m ? (m[1] as BackupKind) : 'unknown',
        createdAt: m ? `${m[2]}T${m[3]}:${m[4]}:${m[5]}Z` : stat.mtime.toISOString(),
        reason: m?.[6] ? m[6].replace(/-/g, ' ') : '',
        size: stat.size,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

function prune(kind: BackupKind, limit: number): void {
  for (const b of list(kind).slice(limit)) fs.rmSync(path.join(paths.backups, b.id), { force: true });
}

/** Snapshot a file. Returns the backup id, or null when there is nothing to back up. */
export function create(kind: BackupKind, reason = '', limit = 30): string | null {
  const target = TARGETS[kind]();
  if (!fs.existsSync(target)) return null;
  ensureDir(paths.backups);
  const name = `${kind}_${timestamp()}${reason ? '_' + slug(reason) : ''}.bak`;
  fs.copyFileSync(target, path.join(paths.backups, name));
  prune(kind, limit);
  return name;
}

function resolveId(id: string): string {
  if (!/^[\w.-]+\.bak$/.test(id)) throw new Error(`Invalid backup id: ${id}`);
  const file = path.join(paths.backups, id);
  if (!fs.existsSync(file)) throw new Error(`Backup not found: ${id}`);
  return file;
}

export function read(id: string): string {
  return readText(resolveId(id));
}

/** Restore a snapshot; the current file is backed up first so restore is undoable. */
export function restore(id: string): BackupKind {
  const file = resolveId(id);
  const kind: BackupKind = id.startsWith('known_hosts_') ? 'known_hosts' : 'config';
  create(kind, 'before-restore');
  writePrivate(TARGETS[kind](), readText(file));
  return kind;
}
