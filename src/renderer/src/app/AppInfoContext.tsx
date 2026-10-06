import { createContext, useContext, type ReactNode } from 'react';
import type { AppInfo } from '../../../shared/ipc';

const AppInfoContext = createContext<AppInfo | null>(null);

export function AppInfoProvider({ value, children }: { value: AppInfo; children: ReactNode }) {
  return <AppInfoContext.Provider value={value}>{children}</AppInfoContext.Provider>;
}

/** Static facts about the installation (platform, paths, CLI command). */
export function useAppInfo(): AppInfo {
  const ctx = useContext(AppInfoContext);
  if (!ctx) throw new Error('useAppInfo must be used inside <AppInfoProvider>');
  return ctx;
}
