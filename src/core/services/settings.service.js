'use strict';

const store = require('../state/store');

function get() {
  return store.load().settings;
}

function update(patch) {
  return store.update((state) => {
    for (const key of Object.keys(patch || {})) {
      if (!(key in store.DEFAULT_SETTINGS)) throw new Error(`Unknown setting: ${key}`);
    }
    state.settings = { ...state.settings, ...patch };
    return state.settings;
  });
}

module.exports = { get, update };
