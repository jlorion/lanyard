/** SSH config hosts (servers): CRUD, raw editing, testing and resolution. */

import * as sshConfig from '../ssh-config';
import * as repo from '../ssh-config/config.repository';
import { run, SshmError } from '../utils/exec';
import type { ConfigValidation, HostEntry, HostInput, HostOption, TestResult } from '../../shared/types';

const ALIAS_RE = /^[\w.@:-]+$/;

export function assertAlias(alias: string): string {
  if (!ALIAS_RE.test(alias || '')) throw new Error(`Invalid host alias: ${alias}`);
  return alias;
}

export function list(): HostEntry[] {
  return sshConfig.listHosts(repo.load());
}

/** Hosts you can actually connect to (no wildcard patterns). */
export function connectable(): HostEntry[] {
  return list().filter((h) => !h.isPattern);
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
    if (!v.ok) throw new SshmError(`ssh rejected the config:\n${v.error}`, 'INVALID_CONFIG');
  }
  return { saved: repo.writeRaw(text, 'raw-edit') };
}

/** Non-interactive login test: runs `exit` on the server. */
export async function test(alias: string): Promise<TestResult> {
  assertAlias(alias);
  const r = await run('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
    alias, 'exit',
  ], { timeout: 25000 });
  const output = `${r.stdout}\n${r.stderr}`.trim();
  let message = r.code === 0 ? 'Login succeeded' : `ssh exited with code ${r.code}`;
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
