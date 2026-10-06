/** SSH config hosts: list, show, add, edit, rm, test, resolve, connect. */

import type { Command } from 'commander';
import * as out from '../utils/output';
import { interactive } from '../utils/system';
import type { CommandModule, Core } from '../types';
import type { HostEntry, HostOption } from '../../shared/types';

const { c } = out;

interface HostFlags {
  hostname?: string;
  user?: string;
  port?: string;
  key?: string;
  proxyJump?: string;
  forwardAgent?: string;
  option?: string[];
  unset?: string[];
  comment?: string;
}

const FLAG_KEYS: [keyof HostFlags, string][] = [
  ['hostname', 'HostName'],
  ['user', 'User'],
  ['port', 'Port'],
  ['key', 'IdentityFile'],
  ['proxyJump', 'ProxyJump'],
  ['forwardAgent', 'ForwardAgent'],
];

function withHostOptions(cmd: Command): Command {
  return cmd
    .option('-H, --hostname <hostname>', 'real host name or IP')
    .option('-u, --user <user>', 'login user')
    .option('-p, --port <port>', 'port')
    .option('-k, --key <path>', 'IdentityFile')
    .option('-J, --proxy-jump <host>', 'ProxyJump')
    .option('--forward-agent <yes|no>', 'ForwardAgent')
    .option('-o, --option <Key=Value...>', 'any other ssh_config option (repeatable)')
    .option('--unset <Key...>', 'remove options')
    .option('--comment <text>', 'comment shown above the host');
}

/** Merge CLI flags into an option list, replacing keys that are set. */
function mergeOptions(existing: HostOption[], o: HostFlags): HostOption[] {
  const options = existing.map((x) => ({ ...x }));
  const set = (key: string, value: string) => {
    const i = options.findIndex((x) => x.key.toLowerCase() === key.toLowerCase());
    if (i === -1) options.push({ key, value });
    else options[i].value = value;
  };
  for (const [flag, key] of FLAG_KEYS) {
    const v = o[flag];
    if (typeof v === 'string') set(key, v);
  }
  for (const kv of o.option ?? []) {
    const m = kv.match(/^([A-Za-z]+)\s*[= ]\s*(.+)$/);
    if (!m) throw new Error(`Bad option "${kv}". Use Key=Value.`);
    set(m[1], m[2]);
  }
  const unset = new Set((o.unset ?? []).map((k) => k.toLowerCase()));
  return options.filter((x) => !unset.has(x.key.toLowerCase()));
}

function findHost(core: Core, alias: string): HostEntry {
  const host = core.hosts.list().find((h) => h.aliases.includes(alias));
  if (!host) throw new Error(`No host "${alias}" in ${core.paths.config}`);
  return host;
}

function assertUserHost(h: HostEntry): void {
  if (h.managed) throw new Error('This entry is managed by sshm. Use `sshm accounts` instead.');
}

export const register: CommandModule = (program, core) => {
  const hosts = program.command('hosts').alias('host').description('manage Host entries in ~/.ssh/config');

  hosts
    .command('list', { isDefault: true })
    .description('list hosts')
    .option('-a, --all', 'include managed provider entries and wildcard patterns')
    .action(out.action((o: { all?: boolean }) => {
      const list = core.hosts.list().filter((h) => o.all || (!h.managed && !h.isPattern));
      out.emit(list, () => out.table(list, [
        { key: 'patterns', label: 'Host', format: (v, h) => (h.managed ? c.magenta(v) : c.bold(v)) },
        { key: 'hostName', label: 'HostName' },
        { key: 'user', label: 'User' },
        { key: 'port', label: 'Port' },
        { key: 'identityFile', label: 'IdentityFile' },
        { key: 'managed', label: '', format: (v) => (v ? c.dim('managed') : '') },
      ]));
    }));

  hosts
    .command('show <alias>')
    .description('show a host block')
    .action(out.action((alias: string) => {
      const h = findHost(core, alias);
      out.emit(h, () => {
        if (h.comment) out.print(c.dim(h.comment.split('\n').map((l) => `# ${l}`).join('\n')));
        out.print(c.bold(`${h.kind} ${h.patterns}`) + (h.managed ? c.dim('  (managed by sshm)') : ''));
        for (const opt of h.options) out.print(`    ${opt.key} ${opt.value}`);
      });
    }));

  withHostOptions(hosts.command('add <alias>').description('add a host'))
    .action(out.action((alias: string, o: HostFlags) => {
      core.hosts.save({ patterns: alias, options: mergeOptions([], o), comment: o.comment });
      out.ok(`Added host ${c.bold(alias)}`);
    }));

  withHostOptions(hosts.command('edit <alias>').description('change a host (only the given options)'))
    .option('--rename <alias>', 'new alias')
    .action(out.action((alias: string, o: HostFlags & { rename?: string }) => {
      const h = findHost(core, alias);
      assertUserHost(h);
      core.hosts.save({
        index: h.index,
        originalPatterns: h.patterns,
        patterns: o.rename ?? h.patterns,
        options: mergeOptions(h.options, o),
        comment: o.comment,
      });
      out.ok(`Updated host ${c.bold(o.rename ?? alias)}`);
    }));

  hosts
    .command('rm <alias>')
    .description('remove a host')
    .action(out.action((alias: string) => {
      const h = findHost(core, alias);
      assertUserHost(h);
      core.hosts.remove(h.index, h.patterns);
      out.ok(`Removed host ${alias}`);
    }));

  hosts
    .command('test <alias>')
    .description('try a non-interactive login')
    .action(out.action(async (alias: string) => {
      const r = await core.hosts.test(alias);
      out.emit(r, () => {
        out.print(`${r.ok ? c.green('✔') : c.red('✖')} ${alias}: ${r.message}`);
        if (!r.ok && r.output) out.print(c.dim(r.output));
      });
      if (!r.ok) process.exitCode = 1;
    }));

  hosts
    .command('resolve <alias>')
    .description('print the effective settings ssh will use (ssh -G)')
    .action(out.action(async (alias: string) => {
      const opts = await core.hosts.resolve(alias);
      out.emit(opts, () => opts.forEach((o) => out.print(`${c.dim(o.key.padEnd(28))} ${o.value}`)));
    }));

  program
    .command('connect <alias> [sshArgs...]')
    .alias('c')
    .description('open an SSH session to a host')
    .action(out.action((alias: string, sshArgs: string[] = []) => {
      core.hosts.assertAlias(alias);
      process.exitCode = interactive('ssh', [alias, ...sshArgs]);
    }));
};
