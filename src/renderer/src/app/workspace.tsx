/**
 * Shared, auto-refreshing snapshot of accounts, hosts and keys for the app
 * shell (sidebar counts, top bar, command palette, overview). Pages that edit
 * data keep their own resources.
 */

import { createContext, useContext, type ReactNode } from 'react';
import { api } from '../lib/api';
import { useResource } from '../hooks/useResource';
import type { HostEntry, KeyInfo, ProviderOverview } from '../../../shared/types';

interface Workspace {
  providers: ProviderOverview[];
  hosts: HostEntry[];
  keys: KeyInfo[];
  loading: boolean;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const providers = useResource(() => api.accounts.overview(), ['state', 'config', 'keys']);
  const hosts = useResource(() => api.hosts.list(), ['config']);
  const keys = useResource(() => api.keys.list(), ['keys']);

  const value: Workspace = {
    providers: providers.data ?? [],
    hosts: (hosts.data ?? []).filter((h) => !h.managed && !h.isPattern),
    keys: (keys.data ?? []).filter((k) => k.hasPrivate),
    loading: providers.loading || hosts.loading || keys.loading,
  };
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside <WorkspaceProvider>');
  return ctx;
}
