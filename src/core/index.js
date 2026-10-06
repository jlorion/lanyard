'use strict';

/**
 * Public facade of the core. The Electron main process and the CLI both talk
 * to SSH exclusively through this object; nothing outside src/core touches
 * ~/.ssh directly.
 */

const { paths } = require('./config/paths');
const providers = require('./providers');
const accounts = require('./services/accounts.service');
const hosts = require('./services/hosts.service');
const settings = require('./services/settings.service');
const keys = require('./keys/keys.service');
const knownHosts = require('./known-hosts/known-hosts.service');
const agent = require('./agent/agent.service');
const backups = require('./backups/backup.service');
const git = require('./git/git.service');
const remoteUrl = require('./git/remote-url');
const terminal = require('./terminal/terminal');
const store = require('./state/store');

module.exports = {
  paths,
  providers,
  accounts,
  hosts,
  settings,
  keys,
  knownHosts,
  agent,
  backups,
  git,
  remoteUrl,
  terminal,
  store,
};
