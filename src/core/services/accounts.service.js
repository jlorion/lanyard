'use strict';

/**
 * Git provider accounts (GitHub, GitLab, Hugging Face, ...).
 *
 * Each account is a key registered with a provider. sshm renders two kinds of
 * Host blocks into the managed section of ~/.ssh/config:
 *
 *   Host github.com            <- the ACTIVE account; plain git URLs use it.
 *   Host github.com-<name>     <- one alias per account, usable side by side.
 *
 * "Switching" an account rewrites the first block to point at another key.
 */

const store = require('../state/store');
const sshConfig = require('../ssh-config');
const repo = require('../ssh-config/config.repository');
const providers = require('../providers');
const keys = require('../keys/keys.service');
const gitService = require('../git/git.service');
const { toAliasUrl } = require('../git/remote-url');
const { toTilde, samePath } = require('../config/paths');
const { run } = require('../utils/exec');

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/i;
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

// ---------------------------------------------------------------- rendering

function blockOptions(p, account, { withHostName }) {
  const opts = [];
  if (withHostName) opts.push({ key: 'HostName', value: providers.primaryHost(p) });
  opts.push({ key: 'User', value: p.user });
  if (p.port) opts.push({ key: 'Port', value: p.port });
  opts.push({ key: 'IdentityFile', value: account.keyPath });
  opts.push({ key: 'IdentitiesOnly', value: 'yes' });
  return opts;
}

function managedEntries(state) {
  const entries = [];
  for (const p of providers.allProviders(state)) {
    const accounts = state.accounts.filter((a) => a.provider === p.id);
    if (!accounts.length) continue;
    const active = accounts.find((a) => a.name === state.active[p.id]);
    if (active) {
      entries.push({
        comment: `${p.name} - active account: ${active.name}`,
        patterns: p.hosts.join(' '),
        // Custom providers may map a friendly host to a different real host.
        options: blockOptions(p, active, { withHostName: !!p.custom && p.hosts[0] !== providers.primaryHost(p) }),
      });
    }
    for (const a of accounts) {
      entries.push({
        comment: `${p.name} - account: ${a.name}`,
        patterns: providers.aliasFor(p, a.name),
        options: blockOptions(p, a, { withHostName: true }),
      });
    }
  }
  return entries;
}

/** Regenerate the managed section of ~/.ssh/config from state. */
function sync(state = store.load(), reason = 'sync') {
  const model = repo.load();
  model.managedLines = sshConfig.renderManaged(managedEntries(state));
  return repo.save(model, reason);
}

// ---------------------------------------------------------------- queries

function plainProvider(p) {
  const { success, username, failure, ...rest } = p;
  return rest;
}

function decorate(p, a, state) {
  let keyExists = true;
  let keyEncrypted = false;
  try {
    const k = keys.get(a.keyPath);
    keyExists = !!k.path;
    keyEncrypted = k.encrypted;
  } catch {
    keyExists = false;
  }
  return {
    ...a,
    alias: providers.aliasFor(p, a.name),
    active: state.active[p.id] === a.name,
    keyExists,
    keyEncrypted,
  };
}

/** User-defined blocks that also match a provider host and may interfere. */
function conflictsFor(p, hosts) {
  return hosts
    .filter((h) => !h.managed && h.aliases.some((a) => p.hosts.includes(a)))
    .map((h) => `Your config also defines "Host ${h.patterns}". The managed block wins, but its IdentityFile is still offered as a fallback.`);
}

function overview() {
  const state = store.load();
  const hosts = sshConfig.listHosts(repo.load());
  return providers.allProviders(state).map((p) => ({
    ...plainProvider(p),
    accounts: state.accounts.filter((a) => a.provider === p.id).map((a) => decorate(p, a, state)),
    active: state.active[p.id] || null,
    conflicts: conflictsFor(p, hosts),
  }));
}

function list(providerId) {
  return overview()
    .filter((p) => !providerId || p.id === providerId)
    .flatMap((p) => p.accounts.map((a) => ({ ...a, providerName: p.name })));
}

function find(state, providerId, name) {
  const a = state.accounts.find((x) => x.provider === providerId && x.name === name);
  if (!a) throw new Error(`No ${providerId} account named "${name}".`);
  return a;
}

// ---------------------------------------------------------------- commands

async function applyGitIdentity(account) {
  if (!account.setGitIdentity || (!account.gitName && !account.gitEmail)) return false;
  await gitService.setGlobalIdentity({ name: account.gitName, email: account.gitEmail });
  return true;
}

/**
 * input = { provider, name, keyPath? | generate?: { type, passphrase, comment },
 *           gitName?, gitEmail?, setGitIdentity?, activate? }
 */
async function add(input) {
  const state = store.load();
  const p = providers.getProvider(state, input.provider);
  const name = String(input.name || '').trim();
  if (!NAME_RE.test(name)) throw new Error('Account name may only contain letters, digits, ".", "_" and "-".');
  if (state.accounts.some((a) => a.provider === p.id && a.name === name)) {
    throw new Error(`${p.name} already has an account named "${name}".`);
  }

  let keyPath;
  let publicKey = null;
  if (input.generate) {
    const type = input.generate.type || 'ed25519';
    const key = await keys.generate({
      name: input.generate.fileName || `id_${type}_${p.id}_${name}`,
      type,
      comment: input.generate.comment || input.gitEmail || `${name}@${providers.primaryHost(p)}`,
      passphrase: input.generate.passphrase || '',
    });
    keyPath = key.tildePath;
    publicKey = await keys.publicKey(key.path);
  } else {
    keyPath = toTilde(keys.resolve(input.keyPath));
  }

  const account = {
    id: `${p.id}:${name}`,
    provider: p.id,
    name,
    keyPath,
    gitName: input.gitName || '',
    gitEmail: input.gitEmail || '',
    setGitIdentity: !!input.setGitIdentity,
    createdAt: new Date().toISOString(),
  };
  state.accounts.push(account);
  const activate = input.activate || !state.active[p.id];
  if (activate) state.active[p.id] = name;
  store.save(state);
  sync(state, `add-${p.id}-${name}`);
  if (activate) await applyGitIdentity(account);

  return { account: decorate(p, account, state), publicKey, keysUrl: p.keysUrl, keyHint: p.keyHint || '' };
}

async function update(providerId, name, patch) {
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
  for (const k of ['gitName', 'gitEmail']) if (patch[k] !== undefined) account[k] = patch[k];
  if (patch.setGitIdentity !== undefined) account.setGitIdentity = !!patch.setGitIdentity;
  store.save(state);
  sync(state, `edit-${providerId}-${account.name}`);
  return decorate(p, account, state);
}

async function remove(providerId, name, { deleteKey = false } = {}) {
  const state = store.load();
  const account = find(state, providerId, name);
  state.accounts = state.accounts.filter((a) => a !== account);
  if (state.active[providerId] === name) delete state.active[providerId];
  store.save(state);
  sync(state, `remove-${providerId}-${name}`);

  let trashed = null;
  if (deleteKey) {
    const stillUsed = state.accounts.some((a) => samePath(a.keyPath, account.keyPath));
    if (!stillUsed) trashed = keys.remove(account.keyPath);
  }
  return { removed: account.id, trashed };
}

/** Make `name` the active account for a provider (or clear it with name = null). */
async function use(providerId, name) {
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

/** `ssh -T` against the account alias, exactly the path git will take. */
async function test(providerId, name) {
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
  const decorated = decorate(p, account, state);
  if (!result.ok && decorated.keyEncrypted) {
    result.hint = 'This key has a passphrase. Load it into ssh-agent first (Agent page or `sshm agent add`).';
  }
  if (!result.ok && !decorated.keyExists) result.hint = `Key file ${account.keyPath} no longer exists.`;

  store.update((s) => {
    const a = s.accounts.find((x) => x.id === account.id);
    if (a) a.lastTest = { ok: result.ok, message: result.message, username: result.username || '', at: new Date().toISOString() };
  });
  return { account: account.id, target, ...result };
}

function cloneUrl(providerId, name, repoUrl) {
  const state = store.load();
  const p = providers.getProvider(state, providerId);
  const account = find(state, providerId, name);
  return toAliasUrl(repoUrl, providers.aliasFor(p, account.name), p.user);
}

/** Point a local repository's remote at an account alias and set its identity. */
async function applyToRepo(providerId, name, dir, { remote = 'origin', setIdentity = true } = {}) {
  const state = store.load();
  const account = find(state, providerId, name);
  const remotes = await gitService.getRemotes(dir);
  if (!remotes[remote]) throw new Error(`Remote "${remote}" not found in ${dir}.`);
  const url = cloneUrl(providerId, name, remotes[remote]);
  await gitService.setRemoteUrl(dir, remote, url);
  if (setIdentity) await gitService.setLocalIdentity(dir, { name: account.gitName, email: account.gitEmail });
  return { remote, from: remotes[remote], to: url };
}

// ---------------------------------------------------------- custom providers

function addProvider({ id, name, hostname, port, user, keysUrl }) {
  if (!PROVIDER_ID_RE.test(id || '')) throw new Error('Provider id may only contain lowercase letters, digits and "-".');
  if (!/^[\w.-]+$/.test(hostname || '')) throw new Error('A valid hostname is required.');
  return store.update((state) => {
    if (providers.allProviders(state).some((p) => p.id === id)) throw new Error(`Provider "${id}" already exists.`);
    const custom = { id, name: name || hostname, hostname, hosts: [hostname], port: port ? String(port) : '', user: user || 'git', keysUrl: keysUrl || '' };
    state.customProviders.push(custom);
    return custom;
  });
}

function removeProvider(id) {
  return store.update((state) => {
    if (!state.customProviders.some((p) => p.id === id)) throw new Error(`"${id}" is not a custom provider.`);
    if (state.accounts.some((a) => a.provider === id)) throw new Error('Remove the provider\'s accounts first.');
    state.customProviders = state.customProviders.filter((p) => p.id !== id);
    delete state.active[id];
    return { removed: id };
  });
}

module.exports = {
  sync,
  overview,
  list,
  add,
  update,
  remove,
  use,
  test,
  cloneUrl,
  applyToRepo,
  addProvider,
  removeProvider,
};
