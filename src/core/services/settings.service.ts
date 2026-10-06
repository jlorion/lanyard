import * as store from '../state/store';
import type { Settings } from '../../shared/types';

export function get(): Settings {
  return store.load().settings;
}

export function update(patch: Partial<Settings>): Settings {
  return store.update((state) => {
    for (const key of Object.keys(patch)) {
      if (!(key in store.DEFAULT_SETTINGS)) throw new Error(`Unknown setting: ${key}`);
    }
    state.settings = { ...state.settings, ...patch };
    return state.settings;
  });
}
