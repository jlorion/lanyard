'use strict';

/**
 * sshm's own persistent state (~/.sshm/state.json), shared by the desktop app
 * and the CLI. Always read fresh: the other process may have changed it.
 */

const { paths } = require('../config/paths');
const { readText, writeAtomic } = require('../utils/fs-safe');

const DEFAULT_SETTINGS = {
  closeToTray: true,
  startHidden: false,
  launchAtLogin: false,
  terminal: 'auto', // auto | wt | cmd | powershell | terminal | iterm | x-terminal-emulator
  backupLimit: 30,
};

function defaults() {
  return {
    version: 1,
    accounts: [],
    active: {},
    customProviders: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

function load() {
  const raw = readText(paths.state, '');
  if (!raw.trim()) return defaults();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Could not parse ${paths.state}: ${err.message}`);
  }
  const base = defaults();
  return {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    active: data.active || {},
    accounts: data.accounts || [],
    customProviders: data.customProviders || [],
  };
}

function save(state) {
  writeAtomic(paths.state, JSON.stringify(state, null, 2) + '\n');
}

/** Load, mutate, save. The mutator may return a value that is passed through. */
function update(mutator) {
  const state = load();
  const result = mutator(state);
  save(state);
  return result;
}

module.exports = { load, save, update, DEFAULT_SETTINGS };
