import type { ComponentType } from 'react';
import { Fingerprint, GitBranch, History, KeyRound, Server, Settings, ShieldCheck } from 'lucide-react';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { HostsPage } from '../features/hosts/HostsPage';
import { KeysPage } from '../features/keys/KeysPage';
import { AgentPage } from '../features/agent/AgentPage';
import { KnownHostsPage } from '../features/known-hosts/KnownHostsPage';
import { BackupsPage } from '../features/backups/BackupsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export type PageId = 'accounts' | 'hosts' | 'keys' | 'agent' | 'known-hosts' | 'backups' | 'settings';

export interface Route {
  id: PageId;
  label: string;
  icon: ComponentType<{ size?: number }>;
  section: 'Git' | 'SSH' | 'App';
  component: ComponentType;
}

export const ROUTES: Route[] = [
  { id: 'accounts', label: 'Git accounts', icon: GitBranch, section: 'Git', component: AccountsPage },
  { id: 'hosts', label: 'Hosts', icon: Server, section: 'SSH', component: HostsPage },
  { id: 'keys', label: 'Keys', icon: KeyRound, section: 'SSH', component: KeysPage },
  { id: 'agent', label: 'ssh-agent', icon: ShieldCheck, section: 'SSH', component: AgentPage },
  { id: 'known-hosts', label: 'Known hosts', icon: Fingerprint, section: 'SSH', component: KnownHostsPage },
  { id: 'backups', label: 'Backups', icon: History, section: 'App', component: BackupsPage },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'App', component: SettingsPage },
];

export function isPageId(value: string): value is PageId {
  return ROUTES.some((r) => r.id === value);
}
