/**
 * One-time migration from the pre-rename data directory (~/.sshm) to
 * ~/.lanyard. The ~/.ssh/config managed section is migrated lazily: the parser
 * recognises the old markers and the next write uses the new ones.
 */

import fs from 'node:fs';
import { paths, LEGACY_DATA_DIR, dataDirOverridden } from '../config/paths';

let done = false;

export function migrateLegacyData(): void {
  if (done) return;
  done = true;
  if (dataDirOverridden()) return;
  const target = paths.dataDir;
  if (fs.existsSync(target) || !fs.existsSync(LEGACY_DATA_DIR)) return;
  try {
    fs.renameSync(LEGACY_DATA_DIR, target);
  } catch {
    // Rename can fail across volumes or while a file is open; copy instead and keep the original.
    fs.cpSync(LEGACY_DATA_DIR, target, { recursive: true });
  }
}
