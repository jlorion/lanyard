// Pre-rename data migration (~/.sshm -> ~/.lanyard), run against a fake home directory.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'lanyard-home-'));
process.env.HOME = home;
process.env.USERPROFILE = home; // os.homedir() on Windows
delete process.env.LANYARD_HOME;
delete process.env.SSHM_HOME;

const { migrateLegacyData } = await import('../src/core/state/migrate');

afterAll(() => fs.rmSync(home, { recursive: true, force: true }));

describe('legacy data migration', () => {
  it('moves ~/.sshm to ~/.lanyard once', () => {
    fs.mkdirSync(path.join(home, '.sshm', 'backups'), { recursive: true });
    fs.writeFileSync(path.join(home, '.sshm', 'state.json'), '{"version":1}');

    migrateLegacyData();

    expect(fs.readFileSync(path.join(home, '.lanyard', 'state.json'), 'utf8')).toBe('{"version":1}');
    expect(fs.existsSync(path.join(home, '.lanyard', 'backups'))).toBe(true);
    expect(fs.existsSync(path.join(home, '.sshm'))).toBe(false);
  });
});
