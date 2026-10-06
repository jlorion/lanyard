/** Provider accounts: status, providers, accounts, use, test, url, repo. */

import path from 'node:path';
import * as out from '../utils/output';
import type { CommandModule } from '../types';
import type { AccountTestResult, KeyType } from '../../shared/types';

const { c } = out;

function printTest(r: AccountTestResult): void {
  out.print(`${r.ok ? c.green('✔') : c.red('✖')} ${c.bold(r.account)} ${c.dim(`(${r.target})`)} - ${r.message}`);
  if (r.hint) out.print(`  ${c.yellow(r.hint)}`);
}

export const register: CommandModule = (program, core) => {
  program
    .command('status')
    .description('show the active account for every provider that has accounts')
    .action(out.action(async () => {
      const providers = core.accounts.overview().filter((p) => p.accounts.length);
      const git = await core.git.getGlobalIdentity();
      const data = { providers: providers.map((p) => ({ id: p.id, active: p.active, accounts: p.accounts.map((a) => a.name) })), git };
      out.emit(data, () => {
        if (!providers.length) {
          out.info('No accounts yet. Add one with: lanyard accounts add <provider> <name> --generate');
          return;
        }
        out.table(providers, [
          { key: 'name', label: 'Provider' },
          { key: 'active', label: 'Active', format: (v) => (v ? c.green(v) : c.dim('none')) },
          { key: 'accounts', label: 'Accounts', format: (v: { name: string }[]) => v.map((a) => a.name).join(', ') },
          { key: 'hosts', label: 'Host', format: (v: string[]) => v[0] },
        ]);
        out.print('', `${c.dim('git identity:')} ${git.name || '-'} <${git.email || '-'}>`);
        for (const p of providers) for (const w of p.conflicts) out.warn(`${p.name}: ${w}`);
      });
    }));

  // ------------------------------------------------------------ providers
  const providers = program.command('providers').description('list or manage git hosting providers');
  providers
    .command('list', { isDefault: true })
    .description('list providers')
    .action(out.action(() => {
      const list = core.accounts.overview();
      out.emit(list, () => out.table(list, [
        { key: 'id', label: 'Id', format: (v) => c.bold(v) },
        { key: 'name', label: 'Name' },
        { key: 'hosts', label: 'Hosts', format: (v: string[]) => v.join(' ') },
        { key: 'accounts', label: 'Accounts', format: (v: unknown[]) => v.length },
        { key: 'custom', label: 'Type', format: (v) => (v ? 'custom' : 'built-in') },
      ]));
    }));
  providers
    .command('add <id>')
    .description('add a custom provider, e.g. a self-hosted GitLab')
    .requiredOption('--host <hostname>', 'server hostname, e.g. git.company.com')
    .option('--name <name>', 'display name')
    .option('--port <port>', 'ssh port')
    .option('--user <user>', 'ssh user', 'git')
    .option('--keys-url <url>', 'page where SSH keys are registered')
    .action(out.action((id: string, o: { host: string; name?: string; port?: string; user: string; keysUrl?: string }) => {
      const p = core.accounts.addProvider({ id, name: o.name, hostname: o.host, port: o.port, user: o.user, keysUrl: o.keysUrl });
      out.emit(p, () => out.ok(`Added provider ${c.bold(p.id)} (${p.hostname})`));
    }));
  providers
    .command('rm <id>')
    .description('remove a custom provider')
    .action(out.action((id: string) => {
      core.accounts.removeProvider(id);
      out.ok(`Removed provider ${id}`);
    }));

  // ------------------------------------------------------------ accounts
  const accounts = program.command('accounts').alias('acc').description('list or manage provider accounts');
  accounts
    .command('list [provider]', { isDefault: true })
    .description('list accounts')
    .action(out.action((provider?: string) => {
      const list = core.accounts.list(provider);
      out.emit(list, () => out.table(list, [
        { key: 'active', label: '', format: (v) => (v ? c.green('●') : ' ') },
        { key: 'providerName', label: 'Provider' },
        { key: 'name', label: 'Account', format: (v) => c.bold(v) },
        { key: 'alias', label: 'Alias host' },
        { key: 'keyPath', label: 'Key', format: (v, a) => (a.keyExists ? v : c.red(`${v} (missing)`)) },
        { key: 'gitEmail', label: 'Git email' },
        { key: 'lastTest', label: 'Last test', format: (v) => (!v ? '' : v.ok ? c.green(v.username || 'ok') : c.red('failed')) },
      ]));
    }));

  interface AddOpts {
    key?: string;
    generate?: boolean;
    type: KeyType;
    passphrase: string;
    gitName?: string;
    gitEmail?: string;
    setGitIdentity?: boolean;
    activate?: boolean;
  }
  accounts
    .command('add <provider> <name>')
    .description('add an account using an existing key (--key) or a new one (--generate)')
    .option('-k, --key <path>', 'existing private key (name in ~/.ssh or a path)')
    .option('-g, --generate', 'generate a new key for this account')
    .option('-t, --type <type>', 'key type for --generate: ed25519 | rsa | ecdsa', 'ed25519')
    .option('-N, --passphrase <passphrase>', 'passphrase for --generate', '')
    .option('--git-name <name>', 'git user.name for this account')
    .option('--git-email <email>', 'git user.email for this account')
    .option('--set-git-identity', 'set the global git identity when this account becomes active')
    .option('--activate', 'make it the active account right away')
    .action(out.action(async (provider: string, name: string, o: AddOpts) => {
      if (!o.key && !o.generate) throw new Error('Pass --key <path> or --generate.');
      const r = await core.accounts.add({
        provider,
        name,
        keyPath: o.key,
        generate: o.generate ? { type: o.type, passphrase: o.passphrase } : null,
        gitName: o.gitName,
        gitEmail: o.gitEmail,
        setGitIdentity: o.setGitIdentity,
        activate: o.activate,
      });
      out.emit(r, () => {
        out.ok(`Added ${c.bold(r.account.name)} (${r.account.alias})${r.account.active ? c.green(' - active') : ''}`);
        if (r.publicKey) {
          out.print('', c.bold('Public key - register it with the provider:'), r.publicKey, '');
          if (r.keysUrl) out.info(`Add it at ${c.cyan(r.keysUrl)}`);
          if (r.keyHint) out.warn(r.keyHint);
        }
        out.info(`Then verify with: lanyard test ${provider} ${name}`);
      });
    }));

  accounts
    .command('edit <provider> <name>')
    .description('change an account')
    .option('--rename <newName>', 'new account name')
    .option('-k, --key <path>', 'use a different key')
    .option('--git-name <name>')
    .option('--git-email <email>')
    .option('--set-git-identity', 'set the global git identity when activated')
    .option('--no-set-git-identity', 'do not touch the global git identity')
    .action(out.action(async (provider: string, name: string, o: { rename?: string; key?: string; gitName?: string; gitEmail?: string; setGitIdentity?: boolean }) => {
      // Commander leaves setGitIdentity undefined unless one of the two flags is given.
      const a = await core.accounts.update(provider, name, {
        name: o.rename,
        keyPath: o.key,
        gitName: o.gitName,
        gitEmail: o.gitEmail,
        setGitIdentity: o.setGitIdentity,
      });
      out.emit(a, () => out.ok(`Updated ${a.id}`));
    }));

  accounts
    .command('rm <provider> <name>')
    .description('remove an account')
    .option('--delete-key', 'also move its key to ~/.lanyard/trash (if no other account uses it)')
    .action(out.action(async (provider: string, name: string, o: { deleteKey?: boolean }) => {
      const r = await core.accounts.remove(provider, name, { deleteKey: o.deleteKey });
      out.emit(r, () => {
        out.ok(`Removed ${r.removed}`);
        if (r.trashed) out.info(`Key moved to ${r.trashed.trashDir}`);
      });
    }));

  // ------------------------------------------------------------ switching
  program
    .command('use <provider> [name]')
    .alias('switch')
    .description('switch the active account for a provider (plain git@host URLs will use it)')
    .option('--off', 'clear the active account')
    .action(out.action(async (provider: string, name: string | undefined, o: { off?: boolean }) => {
      if (!name && !o.off) {
        const list = core.accounts.list(provider);
        if (!list.length) throw new Error(`No accounts for "${provider}".`);
        out.print(`Accounts for ${provider}:`);
        for (const a of list) out.print(`  ${a.active ? c.green('●') : ' '} ${a.name}`);
        out.print('', c.dim(`Switch with: lanyard use ${provider} <name>`));
        return;
      }
      const r = await core.accounts.use(provider, o.off ? null : name!);
      out.emit(r, () => {
        if (!r.active) out.ok(`${provider}: no active account`);
        else out.ok(`${provider} now uses ${c.bold(r.active)}${r.gitIdentityApplied ? c.dim(' (global git identity updated)') : ''}`);
      });
    }));

  program
    .command('test [provider] [name]')
    .description('verify accounts with `ssh -T` (default: every active account)')
    .option('-a, --all', 'test every account, not just the active ones')
    .action(out.action(async (provider: string | undefined, name: string | undefined, o: { all?: boolean }) => {
      const targets: [string, string][] = provider && name
        ? [[provider, name]]
        : core.accounts.overview()
          .filter((p) => !provider || p.id === provider)
          .flatMap((p) => p.accounts.filter((a) => o.all || a.active).map((a): [string, string] => [p.id, a.name]));
      if (!targets.length) throw new Error('Nothing to test. Add an account first.');
      const results = await Promise.all(targets.map(([p, n]) => core.accounts.test(p, n)));
      out.emit(results, () => results.forEach(printTest));
      if (results.some((r) => !r.ok)) process.exitCode = 1;
    }));

  // ------------------------------------------------------------ git helpers
  program
    .command('url <provider> <name> <repoUrl>')
    .description('rewrite a clone URL to use an account, e.g. for `git clone`')
    .action(out.action((provider: string, name: string, repoUrl: string) => {
      const url = core.accounts.cloneUrl(provider, name, repoUrl);
      out.emit({ url }, () => out.print(url));
    }));

  program
    .command('repo <provider> <name> [dir]')
    .description('point a local repository at an account (rewrites the remote, sets local identity)')
    .option('-r, --remote <remote>', 'remote to rewrite', 'origin')
    .option('--no-identity', 'do not set the repository user.name / user.email')
    .action(out.action(async (provider: string, name: string, dir: string | undefined, o: { remote: string; identity: boolean }) => {
      const r = await core.accounts.applyToRepo(provider, name, path.resolve(dir ?? '.'), { remote: o.remote, setIdentity: o.identity });
      out.emit(r, () => out.ok(`${r.remote}: ${c.dim(r.from)} → ${c.bold(r.to)}`));
    }));
};
