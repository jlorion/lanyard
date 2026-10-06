/**
 * Theme (system / light / dark) and accent colour. Both are per-machine
 * conveniences kept in localStorage and applied as attributes on <html>:
 *   data-theme  = resolved 'light' | 'dark'
 *   data-accent = one of ACCENTS
 * The main process is told about the theme so native chrome matches.
 */

import { api } from './api';

export type ThemeMode = 'system' | 'light' | 'dark';

export const ACCENTS = [
  { id: 'blue', label: 'Blue', swatch: '#1d6fe0' },
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'violet', label: 'Violet', swatch: '#6d5af0' },
  { id: 'teal', label: 'Teal', swatch: '#0d8a7d' },
  { id: 'green', label: 'Green', swatch: '#1f8a4c' },
  { id: 'orange', label: 'Orange', swatch: '#d9590b' },
  { id: 'rose', label: 'Rose', swatch: '#d63864' },
  { id: 'graphite', label: 'Graphite', swatch: '#4b5563' },
] as const;

export type AccentId = (typeof ACCENTS)[number]['id'];

const THEME_KEY = 'lanyard.theme';
const ACCENT_KEY = 'lanyard.accent';
const DEFAULT_ACCENT: AccentId = 'blue';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable
  }
}

export function storedTheme(): ThemeMode {
  const v = read(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export function storedAccent(): AccentId {
  const v = read(ACCENT_KEY);
  return ACCENTS.some((a) => a.id === v) ? (v as AccentId) : DEFAULT_ACCENT;
}

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return media.matches ? 'dark' : 'light';
  return mode;
}

let currentTheme: ThemeMode = 'system';

/** Colour the native window buttons (drawn over our custom title bar) like the top bar. */
function syncTitleBar(): void {
  requestAnimationFrame(() => {
    const css = getComputedStyle(document.documentElement);
    const bg = css.getPropertyValue('--bg').trim();
    const fg = css.getPropertyValue('--text-muted').trim();
    if (bg && fg) void api.app.setTitleBarColors(bg, fg).catch(() => {});
  });
}

export function applyTheme(mode: ThemeMode): void {
  currentTheme = mode;
  document.documentElement.dataset.theme = resolve(mode);
  write(THEME_KEY, mode);
  void api.app.setTheme(mode).catch(() => {});
  syncTitleBar();
}

export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset.accent = accent;
  write(ACCENT_KEY, accent);
}

media.addEventListener('change', () => {
  if (currentTheme !== 'system') return;
  document.documentElement.dataset.theme = resolve('system');
  syncTitleBar();
});

/** 'mac' | 'windows' | 'linux' - lets CSS make room for the native window controls. */
export function detectPlatform(): 'mac' | 'windows' | 'linux' {
  const ua = navigator.userAgent;
  return ua.includes('Mac') ? 'mac' : ua.includes('Windows') ? 'windows' : 'linux';
}
