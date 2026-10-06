'use strict';

/** Thin wrapper over the git CLI for identities and remotes. */

const fs = require('fs');
const path = require('path');
const { run } = require('../utils/exec');

async function git(args, cwd) {
  const r = await run('git', args, { cwd });
  return { ...r, out: r.stdout.trim() };
}

async function available() {
  try {
    return (await git(['--version'])).code === 0;
  } catch {
    return false;
  }
}

async function getGlobalIdentity() {
  try {
    const [name, email, sshCommand] = await Promise.all([
      git(['config', '--global', 'user.name']),
      git(['config', '--global', 'user.email']),
      git(['config', '--global', 'core.sshCommand']),
    ]);
    return { name: name.out, email: email.out, sshCommand: sshCommand.out };
  } catch {
    return { name: '', email: '', sshCommand: '' };
  }
}

async function setGlobalIdentity({ name, email }) {
  if (name) await git(['config', '--global', 'user.name', name]);
  if (email) await git(['config', '--global', 'user.email', email]);
}

/** Set (or unset with an empty value) git's global core.sshCommand. */
async function setSshCommand(command) {
  const args = command
    ? ['config', '--global', 'core.sshCommand', command]
    : ['config', '--global', '--unset', 'core.sshCommand'];
  const r = await git(args);
  if (r.code !== 0 && command) throw new Error(r.stderr.trim() || 'git config failed');
}

function assertRepo(dir) {
  if (!dir || !fs.existsSync(path.join(dir, '.git'))) throw new Error(`Not a git repository: ${dir}`);
}

async function getRemotes(dir) {
  assertRepo(dir);
  const r = await git(['remote', '-v'], dir);
  const remotes = {};
  for (const line of r.out.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
    if (m) remotes[m[1]] = m[2];
  }
  return remotes;
}

async function setRemoteUrl(dir, remote, url) {
  assertRepo(dir);
  const r = await git(['remote', 'set-url', remote, url], dir);
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'git remote set-url failed');
}

async function setLocalIdentity(dir, { name, email }) {
  assertRepo(dir);
  if (name) await git(['config', 'user.name', name], dir);
  if (email) await git(['config', 'user.email', email], dir);
}

module.exports = {
  available,
  getGlobalIdentity,
  setGlobalIdentity,
  setSshCommand,
  getRemotes,
  setRemoteUrl,
  setLocalIdentity,
};
