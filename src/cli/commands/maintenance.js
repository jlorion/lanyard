'use strict';

/** Backups, config file utilities and launching the desktop app. */

const fs = require('fs');
const path = require('path');
const out = require('../utils/output');
const { detached } = require('../utils/system');

const { c } = out;

function launchGui() {
  // Packaged app: the CLI runs inside the app binary with ELECTRON_RUN_AS_NODE.
  if (process.env.SSHM_APP_EXE) {
    detached(process.env.SSHM_APP_EXE, [], { ELECTRON_RUN_AS_NODE: '' });
    return;
  }
  // Development checkout: start Electron from node_modules.
  let electron;
  try {
    electron = require('electron');
  } catch {
    throw new Error('Electron is not installed. Run `npm install` in the project, or install the desktop app.');
  }
  const root = path.resolve(__dirname, '..', '..', '..');
  if (!fs.existsSync(path.join(root, 'dist', 'renderer', 'index.html'))) {
    throw new Error('The UI is not built yet. Run `npm run build` first.');
  }
  detached(electron, [root]);
}

function register(program, core) {
  const backups = program.command('backups').description('list and restore config / known_hosts backups');
  backups
    .command('list', { isDefault: true })
    .description('list backups (newest first)')
    .action(out.action(() => {
      const list = core.backups.list();
      out.emit(list, () => out.table(list, [
        { key: 'id', label: 'Id', format: (v) => c.bold(v) },
        { key: 'kind', label: 'File' },
        { key: 'createdAt', label: 'Created', format: (v) => new Date(v).toLocaleString() },
        { key: 'reason', label: 'Reason' },
      ]));
    }));
  backups
    .command('show <id>')
    .description('print a backup')
    .action(out.action((id) => out.print(core.backups.read(id))));
  backups
    .command('restore <id>')
    .description('restore a backup (the current file is backed up first)')
    .action(out.action((id) => {
      const kind = core.backups.restore(id);
      out.ok(`Restored ${kind} from ${id}`);
    }));

  const config = program.command('config').description('ssh config file utilities');
  config
    .command('path')
    .description('print the paths sshm uses')
    .action(out.action(() => {
      const p = core.paths;
      const data = { sshDir: p.sshDir, config: p.config, knownHosts: p.knownHosts, dataDir: p.dataDir, backups: p.backups };
      out.emit(data, () => Object.entries(data).forEach(([k, v]) => out.print(`${c.dim(k.padEnd(11))} ${v}`)));
    }));
  config
    .command('sync')
    .description('regenerate the managed section from saved accounts')
    .action(out.action(() => {
      const changed = core.accounts.sync(undefined, 'manual-sync');
      out.ok(changed ? 'Managed section rewritten' : 'Already in sync');
    }));
  config
    .command('validate')
    .description('ask OpenSSH whether ~/.ssh/config parses')
    .action(out.action(async () => {
      const r = await core.hosts.validate();
      if (r.ok) out.ok(r.skipped ? 'ssh not found; validation skipped' : 'Config is valid');
      else {
        out.print(`${c.red('✖')} ${r.error}`);
        process.exitCode = 1;
      }
    }));

  program
    .command('gui')
    .alias('open')
    .description('open the desktop app')
    .action(out.action(() => {
      launchGui();
      out.ok('Launching SSH Manager…');
    }));
}

module.exports = { register };
