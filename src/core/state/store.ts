/**
 * Lanyard's own persistent state (~/.lanyard/state.json), shared by the desktop app
 * and the CLI. Always read fresh: the other process may have changed it.
 */

import { paths } from '../config/paths';
import { readText, writeAtomic } from '../utils/fs-safe';
import type { Account, CustomProviderInput, Settings } from '../../shared/types';

export interface StoredCustomProvider extends CustomProviderInput {
  hosts: string[];
  port: string;
  user: string;
  keysUrl: string;
}

export interface State {
  version: 1;
  accounts: Account[];
  /** provider id -> active account name */
  active: Record<string, string>;
  customProviders: StoredCustomProvider[];
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = {
  closeToTray: true,
  startHidden: false,
  launchAtLogin: false,
  terminal: 'auto',
  backupLimit: 30,
};

function defaults(): State {
  return { version: 1, accounts: [], active: {}, customProviders: [], settings: { ...DEFAULT_SETTINGS } };
}

export function load(): State {
  const raw = readText(paths.state, '');
  if (!raw.trim()) return defaults();
  let data: Partial<State>;
  try {
    data = JSON.parse(raw) as Partial<State>;
  } catch (err) {
    throw new Error(`Could not parse ${paths.state}: ${(err as Error).message}`);
  }
  return {
    version: 1,
    accounts: data.accounts ?? [],
    active: data.active ?? {},
    customProviders: data.customProviders ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) },
  };
}

export function save(state: State): void {
  writeAtomic(paths.state, JSON.stringify(state, null, 2) + '\n');
}

/** Load, mutate, save. Whatever the mutator returns is passed through. */
export function update<T>(mutator: (state: State) => T): T {
  const state = load();
  const result = mutator(state);
  save(state);
  return result;
}
