/** SSH config hosts (servers): CRUD, raw editing, testing and resolution. */

import * as sshConfig from '../ssh-config';
import * as repo from '../ssh-config/config.repository';
import * as keys from '../keys/keys.service';
import * as providers from '../providers';
import * as store from '../state/store';
import { toTilde } from '../config/paths';
import { run, LanyardError } from '../utils/exec';
import type { ConfigValidation, HostEntry, HostInput, HostOption, TestResult } from '../../shared/types';

const ALIAS_RE = /^[\w.@:-]+$/;

export function assertAlias(alias: string): string {
  if (!ALIAS_RE.test(alias || '')) throw new Error(`Invalid host alias: ${alias}`);
  return alias;
}

export function list(): HostEntry[] {
  const state = store.load();
  return sshConfig.listHosts(repo.load()).map((h) => ({
    ...h,
    gitProvider: h.isPattern ? null : providers.findByHost(state, h.alias, h.hostName)?.id ?? null,
  }));
}

/** Name of the git provider behind an alias (configured or not), or null for a regular server. */
export function gitProviderFor(alias: string): string | null {
  const host = list().find((h) => h.aliases.includes(alias));
  return providers.findByHost(store.load(), alias, host?.hostName)?.name ?? null;
}

/** Hosts you can open a shell on: no wildcard patterns and no git providers. */
export function connectable(): HostEntry[] {
  return list().filter((h) => !h.isPattern && !h.gitProvider);
}

/** Create (index == null) or update a host. */
export function save(host: HostInput): HostEntry[] {
  const model = repo.load();
  const taken = sshConfig.listHosts(model)
    .filter((h) => h.managed || h.index !== host.index)
    .flatMap((h) => h.aliases);
  const clash = host.patterns.split(/\s+/).find((a) => a && taken.includes(a));
  if (clash) throw new Error(`Another host already uses the alias "${clash}".`);

  if (host.index == null) {
    sshConfig.addHost(model, host);
    repo.save(model, `add-${host.patterns}`);
  } else {
    sshConfig.updateHost(model, host.index, host.originalPatterns, host);
    repo.save(model, `edit-${host.patterns}`);
  }
  return list();
}

/** A user-defined (non-managed) host by alias. */
export function find(alias: string): HostEntry {
  const host = list().find((h) => !h.managed && h.aliases.includes(alias));
  if (!host) throw new Error(`No host "${alias}" in your SSH config.`);
  return host;
}

/**
 * Switch the key a host authenticates with. The first IdentityFile line is
 * rewritten in place (further ones are dropped) and IdentitiesOnly is turned
 * on so ssh offers exactly this key instead of whatever the agent holds.
 * Pass null to go back to ssh's default keys.
 */
export function setKey(alias: string, keyRef: string | null): HostEntry {
  const host = find(alias);
  const keyPath = keyRef ? toTilde(keys.resolve(keyRef)) : null;
  const isKey = (o: HostOption, k: string) => o.key.toLowerCase() === k;

  let replaced = false;
  const options: HostOption[] = [];
  for (const o of host.options) {
    if (isKey(o, 'identityfile')) {
      if (keyPath && !replaced) options.push({ key: o.key, value: keyPath });
      replaced = true;
    } else if (isKey(o, 'identitiesonly')) {
      if (keyPath) options.push({ key: o.key, value: 'yes' });
    } else {
      options.push(o);
    }
  }
  if (keyPath && !replaced) options.push({ key: 'IdentityFile', value: keyPath });
  if (keyPath && !options.some((o) => isKey(o, 'identitiesonly'))) options.push({ key: 'IdentitiesOnly', value: 'yes' });

  const model = repo.load();
  sshConfig.updateHost(model, host.index, host.patterns, { options });
  repo.save(model, `key-${alias}`);
  return find(alias);
}

export function remove(index: number, patterns: string): HostEntry[] {
  const model = repo.load();
  sshConfig.removeHost(model, index, patterns);
  repo.save(model, `remove-${patterns}`);
  return list();
}

export function getRaw(): string {
  return repo.readRaw();
}

export function validate(text: string = repo.readRaw()): Promise<ConfigValidation> {
  return repo.validate(text);
}

export async function saveRaw(text: string, { force = false } = {}): Promise<{ saved: boolean }> {
  if (!force) {
    const v = await repo.validate(text);
    if (!v.ok) throw new LanyardError(`ssh rejected the config:\n${v.error}`, 'INVALID_CONFIG');
  }
  return { saved: repo.writeRaw(text, 'raw-edit') };
}

const BATCH_OPTIONS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new'];

/**
 * Non-interactive login test. Git hosting providers refuse remote commands
 * (GitHub answers "Invalid command" with exit code 1), so hosts that point at
 * a provider are checked with `ssh -T` and the provider's greeting instead.
 */
export async function test(alias: string): Promise<TestResult> {
  assertAlias(alias);
  const host = list().find((h) => h.aliases.includes(alias));
  const provider = providers.findByHost(store.load(), alias, host?.hostName);
  if (provider) {
    const r = await run('ssh', ['-T', ...BATCH_OPTIONS, '-l', provider.user, alias], { timeout: 25000 });
    return providers.interpretTest(provider, r);
  }

  const r = await run('ssh', [...BATCH_OPTIONS, alias, 'exit'], { timeout: 25000 });
  const output = `${r.stdout}\n${r.stderr}`.trim();
  const firstLine = output.split(/\r?\n/).find((l) => l.trim()) ?? '';
  let message = r.code === 0 ? 'Login succeeded' : `ssh exited with code ${r.code}${firstLine ? `: ${firstLine}` : ''}`;
  if (r.timedOut) message = 'Connection timed out';
  else if (/Permission denied/i.test(output)) message = 'Permission denied (key not accepted or needs a passphrase)';
  else if (/Could not resolve hostname/i.test(output)) message = 'Could not resolve hostname';
  else if (/Connection refused/i.test(output)) message = 'Connection refused';
  else if (/Host key verification failed/i.test(output)) message = 'Host key verification failed';
  return { ok: r.code === 0, message, output };
}

/** Effective settings for an alias after all matching blocks apply (`ssh -G`). */
export async function resolve(alias: string): Promise<HostOption[]> {
  assertAlias(alias);
  const r = await run('ssh', ['-G', alias], { timeout: 10000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
  const options: HostOption[] = [];
  for (const line of r.stdout.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(.*)$/);
    if (m) options.push({ key: m[1], value: m[2] });
  }
  return options;
}
