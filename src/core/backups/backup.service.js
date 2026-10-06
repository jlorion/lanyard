'use strict';

/**
 * Snapshots of ~/.ssh/config and known_hosts taken before every write, stored
 * in ~/.sshm/backups as "<kind>_<timestamp>[_<reason>].bak".
 */

const fs = require('fs');
const path = require('path');
const { paths } = require('../config/paths');
const { ensureDir, readText, writePrivate, timestamp } = require('../utils/fs-safe');

const TARGETS = {
  config: () => paths.config,
  known_hosts: () => paths.knownHosts,
};

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function create(kind, reason = '', limit = 30) {
  const target = TARGETS[kind]();
  if (!fs.existsSync(target)) return null;
  ensureDir(paths.backups);
  const name = `${kind}_${timestamp()}${reason ? '_' + slug(reason) : ''}.bak`;
  const file = path.join(paths.backups, name);
  fs.copyFileSync(target, file);
  prune(kind, limit);
  return name;
}

function list(kind) {
  if (!fs.existsSync(paths.backups)) return [];
  return fs.readdirSync(paths.backups)
    .filter((f) => f.endsWith('.bak') && (!kind || f.startsWith(kind + '_')))
    .map((f) => {
      const m = f.match(/^(config|known_hosts)_(\d{4}-\d\d-\d\d)_(\d\d)-(\d\d)-(\d\d)(?:-\d{3})?(?:_(.*))?\.bak$/);
      const stat = fs.statSync(path.join(paths.backups, f));
      return {
        id: f,
        kind: m ? m[1] : 'unknown',
        createdAt: m ? `${m[2]}T${m[3]}:${m[4]}:${m[5]}Z` : stat.mtime.toISOString(),
        reason: m && m[6] ? m[6].replace(/-/g, ' ') : '',
        size: stat.size,
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}

function prune(kind, limit) {
  for (const b of list(kind).slice(limit)) fs.rmSync(path.join(paths.backups, b.id), { force: true });
}

function resolveId(id) {
  if (!/^[\w.-]+\.bak$/.test(id)) throw new Error(`Invalid backup id: ${id}`);
  const file = path.join(paths.backups, id);
  if (!fs.existsSync(file)) throw new Error(`Backup not found: ${id}`);
  return file;
}

function read(id) {
  return readText(resolveId(id));
}

/** Restore a snapshot; the current file is backed up first so restore is undoable. */
function restore(id) {
  const file = resolveId(id);
  const kind = id.startsWith('known_hosts_') ? 'known_hosts' : 'config';
  create(kind, 'before-restore');
  writePrivate(TARGETS[kind](), readText(file));
  return kind;
}

module.exports = { create, list, read, restore };
