/** React state for theme + accent so the sidebar, Settings and palette stay in sync. */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { applyAccent, applyTheme, storedAccent, storedTheme, type AccentId, type ThemeMode } from '../lib/appearance';

interface Appearance {
  theme: ThemeMode;
  accent: AccentId;
  setTheme: (mode: ThemeMode) => void;
  setAccent: (accent: AccentId) => void;
}

const AppearanceContext = createContext<Appearance | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(storedTheme);
  const [accent, setAccentState] = useState<AccentId>(storedAccent);

  const setTheme = useCallback((mode: ThemeMode) => {
    applyTheme(mode);
    setThemeState(mode);
  }, []);
  const setAccent = useCallback((id: AccentId) => {
    applyAccent(id);
    setAccentState(id);
  }, []);

  const value = useMemo(() => ({ theme, accent, setTheme, setAccent }), [theme, accent, setTheme, setAccent]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): Appearance {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used inside <AppearanceProvider>');
  return ctx;
}
