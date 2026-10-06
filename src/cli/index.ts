/** CLI composition root: builds the commander program from command modules. */

import { Command } from 'commander';
import * as core from '../core';
import * as out from './utils/output';
import { register as accounts } from './commands/accounts';
import { register as hosts } from './commands/hosts';
import { register as keys } from './commands/keys';
import { register as agent } from './commands/agent';
import { register as knownHosts } from './commands/known-hosts';
import { register as maintenance } from './commands/maintenance';
import pkg from '../../package.json';
import type { CommandModule } from './types';

const COMMAND_MODULES: CommandModule[] = [accounts, hosts, keys, agent, knownHosts, maintenance];

export function buildProgram(): Command {
  const program = new Command();
  program
    .name('sshm')
    .description('SSH Manager - switch git provider accounts and manage SSH hosts, keys, agent and known_hosts')
    .version(pkg.version)
    .option('--json', 'machine-readable output')
    .hook('preAction', (cmd) => out.setJson(!!cmd.optsWithGlobals().json));

  for (const register of COMMAND_MODULES) register(program, core);

  program.addHelpText('after', `
Examples:
  $ sshm accounts add github work --generate --git-email me@work.com --set-git-identity
  $ sshm accounts add github personal --key ~/.ssh/id_ed25519
  $ sshm use github personal          # git@github.com:... now authenticates as "personal"
  $ sshm test                         # verify every active account
  $ git clone $(sshm url github work https://github.com/acme/app)
  $ sshm hosts add prod -H 203.0.113.10 -u deploy -k ~/.ssh/id_ed25519
  $ sshm connect prod`);
  return program;
}

export async function run(argv: string[] = process.argv): Promise<void> {
  await buildProgram().parseAsync(argv);
}
