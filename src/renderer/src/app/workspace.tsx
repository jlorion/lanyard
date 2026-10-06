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
  /** User-defined, connectable-looking hosts (no managed entries or patterns). */
  hosts: HostEntry[];
  /** Host/Match entries exactly as the Hosts page lists them (one row per account). */
  allHosts: HostEntry[];
  keys: KeyInfo[];
  loading: boolean;
}

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const providers = useResource(() => api.accounts.overview(), ['state', 'config', 'keys']);
  const hosts = useResource(() => api.hosts.list(), ['config']);
  const keys = useResource(() => api.keys.list(), ['keys']);

  // Managed "active switch" blocks (Host github.com -> active key) are shown as
  // the Active status of an account row, not as rows of their own.
  const accountAliases = new Set((providers.data ?? []).flatMap((p) => p.accounts.map((a) => a.alias)));

  const value: Workspace = {
    providers: providers.data ?? [],
    hosts: (hosts.data ?? []).filter((h) => !h.managed && !h.isPattern),
    allHosts: (hosts.data ?? []).filter((h) => !h.managed || accountAliases.has(h.alias)),
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
