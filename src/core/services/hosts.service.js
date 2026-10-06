'use strict';

/** SSH config hosts (servers): CRUD, raw editing, testing and resolution. */

const sshConfig = require('../ssh-config');
const repo = require('../ssh-config/config.repository');
const { run } = require('../utils/exec');

const ALIAS_RE = /^[\w.@:-]+$/;

function assertAlias(alias) {
  if (!ALIAS_RE.test(alias || '')) throw new Error(`Invalid host alias: ${alias}`);
  return alias;
}

function list() {
  return sshConfig.listHosts(repo.load());
}

/** Hosts you can actually connect to (no wildcard patterns). */
function connectable() {
  return list().filter((h) => !h.isPattern);
}

/**
 * Create (index == null) or update a host.
 * host = { index?, originalPatterns?, patterns, options: [{key,value}], comment? }
 */
function save(host) {
  const model = repo.load();
  const taken = sshConfig.listHosts(model)
    .filter((h) => h.managed || h.index !== host.index)
    .flatMap((h) => h.aliases);
  const clash = String(host.patterns || '').split(/\s+/).find((a) => a && taken.includes(a));
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

function remove(index, patterns) {
  const model = repo.load();
  sshConfig.removeHost(model, index, patterns);
  repo.save(model, `remove-${patterns}`);
  return list();
}

function getRaw() {
  return repo.readRaw();
}

function validate(text = repo.readRaw()) {
  return repo.validate(text);
}

async function saveRaw(text, { force = false } = {}) {
  if (!force) {
    const v = await repo.validate(text);
    if (!v.ok) {
      const err = new Error(`ssh rejected the config:\n${v.error}`);
      err.code = 'INVALID_CONFIG';
      throw err;
    }
  }
  repo.writeRaw(text, 'raw-edit');
  return { saved: true };
}

/** Non-interactive login test: runs `exit` on the server. */
async function test(alias) {
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
async function resolve(alias) {
  assertAlias(alias);
  const r = await run('ssh', ['-G', alias], { timeout: 10000 });
  if (r.code !== 0) throw new Error((r.stderr || r.stdout).trim());
  return r.stdout.split(/\r?\n/)
    .map((l) => l.match(/^(\S+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ key: m[1], value: m[2] }));
}

module.exports = { ALIAS_RE, assertAlias, list, connectable, save, remove, getRaw, validate, saveRaw, test, resolve };
