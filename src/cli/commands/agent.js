'use strict';

/** ssh-agent: list, add, rm, clear. */

const out = require('../utils/output');
const { interactive } = require('../utils/system');

const { c } = out;

function register(program, core) {
  const agent = program.command('agent').description('manage identities loaded in ssh-agent');

  agent
    .command('list', { isDefault: true })
    .description('list loaded identities')
    .action(out.action(async () => {
      const s = await core.agent.status();
      out.emit(s, () => {
        if (!s.running) {
          out.warn(s.message);
          return;
        }
        out.table(s.identities, [
          { key: 'type', label: 'Type' },
          { key: 'fingerprint', label: 'Fingerprint', format: (v) => c.dim(v) },
          { key: 'comment', label: 'Comment' },
        ]);
      });
    }));

  agent
    .command('add <key>')
    .description('load a key (prompts for its passphrase if it has one)')
    .action(out.action((key) => {
      const { cmd, args } = core.agent.interactiveAddCommand(key);
      process.exitCode = interactive(cmd, args);
    }));

  agent
    .command('rm <key>')
    .description('unload a key')
    .action(out.action(async (key) => {
      const r = await core.agent.remove(key);
      out.ok(`Removed ${r.removed} from the agent`);
    }));

  agent
    .command('clear')
    .description('unload all keys')
    .action(out.action(async () => {
      await core.agent.clear();
      out.ok('All identities removed from the agent');
    }));
}

module.exports = { register };
