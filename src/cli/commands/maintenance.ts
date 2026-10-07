/** Backups, config file utilities and launching the desktop app. */

import fs from 'node:fs';
import * as out from '../utils/output';
import { detached } from '../utils/system';
import type { CommandModule } from '../types';

const { c } = out;

const NO_DESKTOP_APP =
  'The desktop app is not part of this install (e.g. `npx lanyard-ssh`). ' +
  'Install the Lanyard desktop app to get the window and tray - every feature is also available as a command: `lanyard --help`.';

/**
 * Open the desktop app. The CLI learns where the app lives from the shims the
 * installer wrote (LANYARD_APP_EXE points at the desktop binary); without it
 * there is no window to open.
 */
export function launchGui(): void {
  const exe = process.env.LANYARD_APP_EXE;
  if (!exe || !fs.existsSync(exe)) throw new Error(NO_DESKTOP_APP);
  detached(exe, []);
}

export const register: CommandModule = (program, core) => {
  const backups = program.command('backups').description('list and restore config / known_hosts backups');
  backups
    .command('list', { isDefault: true })
    .description('list backups (newest first)')
    .action(
      out.action(() => {
        const list = core.backups.list();
        out.emit(list, () =>
          out.table(list, [
            { key: 'id', label: 'Id', format: (v) => c.bold(v) },
            { key: 'kind', label: 'File' },
            { key: 'createdAt', label: 'Created', format: (v: string) => new Date(v).toLocaleString() },
            { key: 'reason', label: 'Reason' },
          ]),
        );
      }),
    );
  backups
    .command('show <id>')
    .description('print a backup')
    .action(out.action((id: string) => out.print(core.backups.read(id))));
  backups
    .command('restore <id>')
    .description('restore a backup (the current file is backed up first)')
    .action(
      out.action((id: string) => {
        const kind = core.backups.restore(id);
        out.ok(`Restored ${kind} from ${id}`);
      }),
    );

  const config = program.command('config').description('ssh config file utilities');
  config
    .command('path')
    .description('print the paths Lanyard uses')
    .action(
      out.action(() => {
        const data = core.describePaths();
        out.emit(data, () => Object.entries(data).forEach(([k, v]) => out.print(`${c.dim(k.padEnd(11))} ${v}`)));
      }),
    );
  config
    .command('sync')
    .description('regenerate the managed section from saved accounts')
    .action(
      out.action(() => {
        const changed = core.accounts.sync(undefined, 'manual-sync');
        out.ok(changed ? 'Managed section rewritten' : 'Already in sync');
      }),
    );
  config
    .command('validate')
    .description('ask OpenSSH whether ~/.ssh/config parses')
    .action(
      out.action(async () => {
        const r = await core.hosts.validate();
        if (r.ok) return out.ok(r.skipped ? 'ssh not found; validation skipped' : 'Config is valid');
        out.print(`${c.red('✖')} ${r.error}`);
        process.exitCode = 1;
      }),
    );

  program
    .command('gui')
    .alias('open')
    .description('open the desktop app')
    .action(
      out.action(() => {
        launchGui();
        out.ok('Launching Lanyard…');
      }),
    );
};
