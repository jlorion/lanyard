'use strict';

/** CLI composition root: builds the commander program from command modules. */

const { Command } = require('commander');
const core = require('../core');
const out = require('./utils/output');
const pkg = require('../../package.json');

const COMMAND_MODULES = [
  require('./commands/accounts'),
  require('./commands/hosts'),
  require('./commands/keys'),
  require('./commands/agent'),
  require('./commands/known-hosts'),
  require('./commands/maintenance'),
];

function buildProgram() {
  const program = new Command();
  program
    .name('sshm')
    .description('SSH Manager - switch git provider accounts and manage SSH hosts, keys, agent and known_hosts')
    .version(pkg.version)
    .option('--json', 'machine-readable output')
    .hook('preAction', (cmd) => out.setJson(cmd.optsWithGlobals().json));

  for (const mod of COMMAND_MODULES) mod.register(program, core);

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

async function run(argv = process.argv) {
  await buildProgram().parseAsync(argv);
}

module.exports = { run, buildProgram };
