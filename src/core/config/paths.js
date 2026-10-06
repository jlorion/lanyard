'use strict';

const os = require('os');
const path = require('path');

const HOME = os.homedir();

// Both directories can be overridden through env vars, which keeps tests (and
// experiments) away from the real ~/.ssh.
function sshDir() {
  return process.env.SSHM_SSH_DIR || path.join(HOME, '.ssh');
}

function dataDir() {
  return process.env.SSHM_HOME || path.join(HOME, '.sshm');
}

const paths = {
  get sshDir() { return sshDir(); },
  get config() { return path.join(sshDir(), 'config'); },
  get knownHosts() { return path.join(sshDir(), 'known_hosts'); },
  get dataDir() { return dataDir(); },
  get state() { return path.join(dataDir(), 'state.json'); },
  get backups() { return path.join(dataDir(), 'backups'); },
  get trash() { return path.join(dataDir(), 'trash'); },
};

/** Expand a leading "~" to the home directory. */
function expandTilde(p) {
  if (!p) return p;
  if (p === '~') return HOME;
  if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(HOME, p.slice(2));
  return p;
}

/**
 * Turn an absolute path into the "~/..." form with forward slashes, which is
 * what ssh_config expects and what both Windows OpenSSH and Git's ssh accept.
 */
function toTilde(p) {
  if (!p) return p;
  const abs = path.resolve(expandTilde(p));
  const rel = path.relative(HOME, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
    return ('~/' + rel).replace(/\\/g, '/');
  }
  return abs.replace(/\\/g, '/');
}

/** Normalised comparison key for two paths that may use different spellings. */
function samePath(a, b) {
  if (!a || !b) return false;
  const norm = (p) => {
    const r = path.resolve(expandTilde(p.replace(/^"|"$/g, '')));
    return process.platform === 'win32' ? r.toLowerCase() : r;
  };
  return norm(a) === norm(b);
}

module.exports = { HOME, paths, expandTilde, toTilde, samePath };
