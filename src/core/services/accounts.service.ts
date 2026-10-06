/**
 * Git provider accounts (GitHub, GitLab, Hugging Face, ...).
 *
 * Each account is a key registered with a provider. Lanyard renders two kinds of
 * Host blocks into the managed section of ~/.ssh/config:
 *
 *   Host github.com            <- the ACTIVE account; plain git URLs use it.
 *   Host github.com-<name>     <- one alias per account, usable side by side.
 *
 * "Switching" an account rewrites the first block to point at another key.
 */

import * as store from '../state/store';
import * as sshConfig from '../ssh-config';
import * as repo from '../ssh-config/config.repository';
import * as providers from '../providers';
import * as keys from '../keys/keys.service';
import * as gitService from '../git/git.service';
import { toAliasUrl } from '../git/remote-url';
import { toTilde, samePath } from '../config/paths';
import { run } from '../utils/exec';
import { isValidEmail } from '../../shared/validation';
import type { State } from '../state/store';
import type { Provider } from '../providers';
import type { ManagedEntry } from '../ssh-config';
import type {
  Account,
  AccountTestResult,
  AccountView,
  AddAccountInput,
  AddAccountResult,
  CustomProviderInput,
  HostEntry,
  HostOption,
  ProviderInfo,
  ProviderOverview,
  RepoRewriteResult,
  TrashResult,
  UpdateAccountInput,
  UseResult,
} from '../../shared/types';

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/i;

/**
 * Every account carries the commit identity it should be used with - the SSH
 * key decides who can push, user.name / user.email who the commits say wrote
 * them - so both are required.
 */
function validateIdentity(gitName: string | undefined, gitEmail: string | undefined): { gitName: string; gitEmail: string } {
  const name = (gitName ?? '').trim();
  const email = (gitEmail ?? '').trim();
  if (!name) throw new Error('A git user.name is required for the account.');
  if (!isValidEmail(email)) throw new Error('A valid git user.email is required for the account (e.g. you@example.com).');
  return { gitName: name, gitEmail: email };
}
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------- rendering

function blockOptions(p: Provider, account: Account, withHostName: boolean): HostOption[] {
  const opts: HostOption[] = [];
  if (withHostName) opts.push({ key: 'HostName', value: providers.primaryHost(p) });
  opts.push({ key: 'User', value: p.user });
  if (p.port) opts.push({ key: 'Port', value: p.port });
  opts.push({ key: 'IdentityFile', value: account.keyPath });
  opts.push({ key: 'IdentitiesOnly', value: 'yes' });
  return opts;
}

function managedEntries(state: State): ManagedEntry[] {
  const entries: ManagedEntry[] = [];
  for (const p of providers.allProviders(state)) {
    const accounts = state.accounts.filter((a) => a.provider === p.id);
    if (!accounts.length) continue;
    const active = accounts.find((a) => a.name === state.active[p.id]);
    if (active) {
      entries.push({
        comment: `${p.name} - active account: ${active.name}`,
        patterns: p.hosts.join(' '),
        options: blockOptions(p, active, p.hosts[0] !== providers.primaryHost(p)),
      });
    }
    for (const a of accounts) {
      entries.push({
        comment: `${p.name} - account: ${a.name}`,
        patterns: providers.aliasFor(p, a.name),
        options: blockOptions(p, a, true),
      });
    }
  }
  return entries;
}

/** Regenerate the managed section of ~/.ssh/config from state. Returns true if the file changed. */
export function sync(state: State = store.load(), reason = 'sync'): boolean {
  const model = repo.load();
  model.managedLines = sshConfig.renderManaged(managedEntries(state));
  return repo.save(model, reason);
}

// ---------------------------------------------------------------- queries

function decorate(p: ProviderInfo, a: Account, state: State): AccountView {
  let keyExists = false;
  let keyEncrypted = false;
  try {
    const k = keys.get(a.keyPath);
    keyExists = !!k.path;
    keyEncrypted = k.encrypted;
  } catch {
    // key file is gone
  }
  return {
    ...a,
    alias: providers.aliasFor(p, a.name),
    active: state.active[p.id] === a.name,
    keyExists,
    keyEncrypted,
    providerName: p.name,
  };
}

/** User-defined blocks that also match a provider host and may interfere. */
function conflictsFor(p: ProviderInfo, hosts: HostEntry[]): string[] {
  return hosts
    .filter((h) => !h.managed && h.aliases.some((a) => p.hosts.includes(a)))
    .map((h) => `Your config also defines "Host ${h.patterns}". The managed block wins, but its IdentityFile is still offered as a fallback.`);
}

export function overview(): ProviderOverview[] {
  const state = store.load();
  const hosts = sshConfig.listHosts(repo.load());
  return providers.allProviders(state).map((p) => ({
    ...providers.toInfo(p),
    accounts: state.accounts.filter((a) => a.provider === p.id).map((a) => decorate(p, a, state)),
    active: state.active[p.id] ?? null,
    conflicts: conflictsFor(p, hosts),
  }));
}

export function list(providerId?: string): AccountView[] {
  return overview()
    .filter((p) => !providerId || p.id === providerId)
    .flatMap((p) => p.accounts);
}

function find(state: State, providerId: string, name: string): Account {
  const a = state.accounts.find((x) => x.provider === providerId && x.name === name);
  if (!a) throw new Error(`No ${providerId} account named "${name}".`);
  return a;
}

// ---------------------------------------------------------------- commands

async function applyGitIdentity(account: Account): Promise<boolean> {
  if (!account.setGitIdentity || (!account.gitName && !account.gitEmail)) return false;
  await gitService.setGlobalIdentity({ name: account.gitName, email: account.gitEmail });
  return true;
}

export async function add(input: AddAccountInput): Promise<AddAccountResult> {
  const state = store.load();
  const p = providers.getProvider(state, input.provider);
  const name = (input.name ?? '').trim();
  if (!NAME_RE.test(name)) throw new Error('Account name may only contain letters, digits, ".", "_" and "-".');
  const identity = validateIdentity(input.gitName, input.gitEmail);
  if (state.accounts.some((a) => a.provider === p.id && a.name === name)) {
    throw new Error(`${p.name} already has an account named "${name}".`);
  }

  let keyPath: string;
  let publicKey: string | null = null;
  if (input.generate) {
    const type = input.generate.type ?? 'ed25519';
    const key = await keys.generate({
      name: input.generate.fileName || `id_${type}_${p.id}_${name}`,
      type,
      comment: input.generate.comment || identity.gitEmail,
      passphrase: input.generate.passphrase ?? '',
    });
    keyPath = key.tildePath;
    publicKey = await keys.publicKey(key.path!);
  } else {
    if (!input.keyPath) throw new Error('Choose an existing key or generate a new one.');
    keyPath = toTilde(keys.resolve(input.keyPath));
  }

  const account: Account = {
    id: `${p.id}:${name}`,
    provider: p.id,
    name,
    keyPath,
    gitName: identity.gitName,
    gitEmail: identity.gitEmail,
    setGitIdentity: !!input.setGitIdentity,
    createdAt: new Date().toISOString(),
  };
  state.accounts.push(account);
  const activate = input.activate || !state.active[p.id];
  if (activate) state.active[p.id] = name;
  store.save(state);
  sync(state, `add-${p.id}-${name}`);
  if (activate) await applyGitIdentity(account);

  return { account: decorate(p, account, state), publicKey, keysUrl: p.keysUrl, keyHint: p.keyHint ?? '' };
}

export async function update(providerId: string, name: string, patch: UpdateAccountInput): Promise<AccountView> {
  const state = store.load();
  const p = providers.getProvider(state, providerId);
  const account = find(state, providerId, name);
  if (patch.name && patch.name !== name) {
    if (!NAME_RE.test(patch.name)) throw new Error('Invalid account name.');
    if (state.accounts.some((a) => a.provider === providerId && a.name === patch.name)) {
      throw new Error(`An account named "${patch.name}" already exists.`);
    }
    if (state.active[providerId] === name) state.active[providerId] = patch.name;
    account.name = patch.name;
    account.id = `${providerId}:${patch.name}`;
  }
  if (patch.keyPath) account.keyPath = toTilde(keys.resolve(patch.keyPath));
  if (patch.gitName !== undefined || patch.gitEmail !== undefined) {
    const identity = validateIdentity(patch.gitName ?? account.gitName, patch.gitEmail ?? account.gitEmail);
    account.gitName = identity.gitName;
    account.gitEmail = identity.gitEmail;
  }
  if (patch.setGitIdentity !== undefined) account.setGitIdentity = patch.setGitIdentity;
  store.save(state);
  sync(state, `edit-${providerId}-${account.name}`);
  return decorate(p, account, state);
}

export async function remove(
  providerId: string,
  name: string,
  { deleteKey = false } = {},
): Promise<{ removed: string; trashed: TrashResult | null }> {
  const state = store.load();
  const account = find(state, providerId, name);
  state.accounts = state.accounts.filter((a) => a !== account);
  if (state.active[providerId] === name) delete state.active[providerId];
  store.save(state);
  sync(state, `remove-${providerId}-${name}`);

  let trashed: TrashResult | null = null;
  if (deleteKey && !state.accounts.some((a) => samePath(a.keyPath, account.keyPath))) {
    trashed = keys.remove(account.keyPath);
  }
  return { removed: account.id, trashed };
}

/** Make `name` the active account for a provider, or clear it with `null`. */
export async function use(providerId: string, name: string | null): Promise<UseResult> {
  const state = store.load();
  const p = providers.getProvider(state, providerId);
  if (name == null) {
    delete state.active[providerId];
    store.save(state);
    sync(state, `deactivate-${providerId}`);
    return { provider: p.id, active: null, gitIdentityApplied: false };
  }
  const account = find(state, providerId, name);
  state.active[providerId] = name;
  store.save(state);
  sync(state, `switch-${providerId}-${name}`);
  const gitIdentityApplied = await applyGitIdentity(account);
  return { provider: p.id, active: name, gitIdentityApplied, account: decorate(p, account, state) };
}

/** `ssh -T` against the account alias - exactly the path git will take. */
export async function test(providerId: string, name?: string): Promise<AccountTestResult> {
  const state = store.load();
  const p = providers.getProvider(state, providerId);
  const accountName = name || state.active[providerId];
  if (!accountName) throw new Error(`${p.name} has no active account. Pass an account name.`);
  const account = find(state, providerId, accountName);

  const target = `${p.user}@${providers.aliasFor(p, account.name)}`;
  const r = await run('ssh', [
    '-T',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=accept-new',
    target,
  ], { timeout: 25000 });
  const result = providers.interpretTest(p, r);
  const view = decorate(p, account, state);
  if (!result.ok && view.keyEncrypted) {
    result.hint = 'This key has a passphrase. Load it into ssh-agent first (Agent page or `lanyard agent add`).';
  }
  if (!result.ok && !view.keyExists) result.hint = `Key file ${account.keyPath} no longer exists.`;

  store.update((s) => {
    const a = s.accounts.find((x) => x.id === account.id);
    if (a) a.lastTest = { ok: result.ok, message: result.message, username: result.username ?? '', at: new Date().toISOString() };
  });
  return { account: account.id, target, ...result };
}

export function cloneUrl(providerId: string, name: string, repoUrl: string): string {
  const state = store.load();
  const p = providers.getProvider(state, providerId);
  const account = find(state, providerId, name);
  return toAliasUrl(repoUrl, providers.aliasFor(p, account.name), p.user);
}

/** Point a local repository's remote at an account alias and set its identity. */
export async function applyToRepo(
  providerId: string,
  name: string,
  dir: string,
  { remote = 'origin', setIdentity = true } = {},
): Promise<RepoRewriteResult> {
  const account = find(store.load(), providerId, name);
  const remotes = await gitService.getRemotes(dir);
  const from = remotes[remote];
  if (!from) throw new Error(`Remote "${remote}" not found in ${dir}.`);
  const to = cloneUrl(providerId, name, from);
  await gitService.setRemoteUrl(dir, remote, to);
  if (setIdentity) await gitService.setLocalIdentity(dir, { name: account.gitName, email: account.gitEmail });
  return { remote, from, to };
}

// ---------------------------------------------------------- custom providers

export function addProvider(input: CustomProviderInput): ProviderInfo {
  const { id, hostname } = input;
  if (!PROVIDER_ID_RE.test(id || '')) throw new Error('Provider id may only contain lowercase letters, digits and "-".');
  if (!/^[\w.-]+$/.test(hostname || '')) throw new Error('A valid hostname is required.');
  return store.update((state) => {
    if (providers.allProviders(state).some((p) => p.id === id)) throw new Error(`Provider "${id}" already exists.`);
    const custom = {
      id,
      name: input.name || hostname,
      hostname,
      hosts: [hostname],
      port: input.port ? String(input.port) : '',
      user: input.user || 'git',
      keysUrl: input.keysUrl || '',
    };
    state.customProviders.push(custom);
    return providers.toInfo(providers.normalizeCustom(custom));
  });
}

export function removeProvider(id: string): { removed: string } {
  return store.update((state) => {
    if (!state.customProviders.some((p) => p.id === id)) throw new Error(`"${id}" is not a custom provider.`);
    if (state.accounts.some((a) => a.provider === id)) throw new Error('Remove the provider\'s accounts first.');
    state.customProviders = state.customProviders.filter((p) => p.id !== id);
    delete state.active[id];
    return { removed: id };
  });
}
