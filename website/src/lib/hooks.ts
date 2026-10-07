import { useEffect, useState } from 'react';
import generated from '../generated/release.json';
import { pickRelease, RELEASES_API, type GithubRelease, type ReleaseInfo } from './assets';
import { RELEASES } from './site';

// ------------------------------------------------------------------ release

/** The release found at build time (or the releases page as a fallback). */
export const BUILD_RELEASE: ReleaseInfo = pickRelease(generated.releases as GithubRelease[]) ?? {
  version: generated.fallbackVersion,
  url: RELEASES,
  assets: {},
};

let live: Promise<ReleaseInfo | null> | null = null;

/**
 * The newest release. Starts with the one baked in at build time, then
 * refreshes from GitHub once per page load so the links follow new releases
 * without a rebuild.
 */
export function useRelease(): ReleaseInfo {
  const [release, setRelease] = useState(BUILD_RELEASE);
  useEffect(() => {
    live ??= fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((r) => (r.ok ? (r.json() as Promise<GithubRelease[]>) : null))
      .then((list) => (list ? pickRelease(list) : null))
      .catch(() => null);
    let alive = true;
    void live.then((r) => {
      if (alive && r) setRelease(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  return release;
}

// ----------------------------------------------------------------------- os

export type Os = 'windows' | 'mac' | 'linux';
export const OS_NAME: Record<Os, string> = { windows: 'Windows', mac: 'macOS', linux: 'Linux' };

function detectOs(): Os | null {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const ua = navigator.userAgent;
  const platform = nav.userAgentData?.platform ?? navigator.platform ?? '';
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return null;
  if (/mac/i.test(platform) || /Mac OS X/.test(ua)) return 'mac';
  if (/win/i.test(platform) || /Windows/.test(ua)) return 'windows';
  if (/linux|x11|cros/i.test(platform + ua)) return 'linux';
  return null;
}

/** The visitor's desktop OS, or null on phones and before hydration. */
export function useOs(): Os | null {
  const [os, setOs] = useState<Os | null>(null);
  useEffect(() => setOs(detectOs()), []);
  return os;
}

// -------------------------------------------------------------------- theme

export type ThemeMode = 'system' | 'light' | 'dark';
const THEME_KEY = 'lanyard-theme';
const listeners = new Set<(m: ThemeMode) => void>();

function storedTheme(): ThemeMode {
  try {
    const m = localStorage.getItem(THEME_KEY);
    return m === 'light' || m === 'dark' ? m : 'system';
  } catch {
    return 'system';
  }
}

export function setTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // private mode: the choice lasts for this page only
  }
  for (const l of listeners) l(mode);
}

/** The chosen theme; every toggle on the page stays in sync. */
export function useTheme(): ThemeMode {
  const [mode, setMode] = useState<ThemeMode>('system');
  useEffect(() => {
    setMode(storedTheme());
    listeners.add(setMode);
    return () => {
      listeners.delete(setMode);
    };
  }, []);
  return mode;
}

// ------------------------------------------------------------------- copy

/** Copy text; `copied` is true for 1.6 s afterwards. */
export function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(t);
  }, [copied]);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => {},
    );
  };
  return [copied, copy];
}
