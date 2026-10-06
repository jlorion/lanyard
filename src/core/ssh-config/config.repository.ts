/** Reads and writes ~/.ssh/config, taking a backup before every change. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { paths } from '../config/paths';
import { readText, writePrivate } from '../utils/fs-safe';
import { run } from '../utils/exec';
import * as backups from '../backups/backup.service';
import * as store from '../state/store';
import { parse, serialize } from './parser';
import type { ConfigModel } from './model';
import type { ConfigValidation } from '../../shared/types';

export function readRaw(): string {
  return readText(paths.config);
}

export function load(): ConfigModel {
  return parse(readRaw());
}

/** Write raw text if it differs from what's on disk. Returns true when written. */
export function writeRaw(text: string, reason: string): boolean {
  if (text === readRaw()) return false;
  backups.create('config', reason, store.load().settings.backupLimit);
  writePrivate(paths.config, text);
  return true;
}

export function save(model: ConfigModel, reason: string): boolean {
  return writeRaw(serialize(model), reason);
}

/**
 * Ask OpenSSH itself whether a config parses (`ssh -G -F <file>`). Reports
 * ok (skipped) when ssh is unavailable so validation never blocks saving.
 */
export async function validate(text: string): Promise<ConfigValidation> {
  const tmp = path.join(os.tmpdir(), `lanyard-validate-${process.pid}-${Date.now()}.conf`);
  fs.writeFileSync(tmp, text, { encoding: 'utf8', mode: 0o600 });
  try {
    const r = await run('ssh', ['-G', '-F', tmp, 'lanyard-validate-probe'], { timeout: 10000 });
    if (r.code === 0) return { ok: true };
    const error = (r.stderr || r.stdout).trim().split(/\r?\n/)
      .filter((l) => !/terminating|^\s*$/.test(l))
      .join('\n')
      .replaceAll(tmp, 'config');
    return { ok: false, error: error || `ssh exited with code ${r.code}` };
  } catch {
    return { ok: true, skipped: true };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
