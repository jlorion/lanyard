/**
 * Light / dark / system theme. The choice is a per-machine convenience, so it
 * lives in localStorage; the main process is told too so native chrome (the
 * Windows title bar, dialogs) matches.
 */

import { api } from './api';

export type ThemeMode = 'system' | 'light' | 'dark';

const KEY = 'lanyard.theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function storedTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // storage unavailable
  }
  return 'system';
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return media.matches ? 'dark' : 'light';
  return mode;
}

let current: ThemeMode = 'system';

export function applyTheme(mode: ThemeMode): void {
  current = mode;
  document.documentElement.dataset.theme = resolve(mode);
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // storage unavailable
  }
  void api.app.setTheme(mode).catch(() => {});
}

media.addEventListener('change', () => {
  if (current === 'system') document.documentElement.dataset.theme = resolve('system');
});
