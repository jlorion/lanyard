import type { ComponentType } from 'react';
import { ArrowRightLeft, KeyRound, Plus, Radar, SquareTerminal, Activity, FileCode2 } from 'lucide-react';
import { ROUTES, type PageId } from '../../app/routes';
import type { Intent } from '../../app/navigation';
import type { HostEntry, KeyInfo, ProviderOverview } from '../../../../shared/types';

export interface PaletteCommand {
  id: string;
  group: 'Switch account' | 'Connect' | 'Host key' | 'Actions' | 'Go to';
  label: string;
  detail?: string;
  icon: ComponentType<{ size?: number }>;
  keywords?: string;
  run: () => void | Promise<unknown>;
}

export interface CommandDeps {
  providers: ProviderOverview[];
  hosts: HostEntry[];
  keys: KeyInfo[];
  navigate: (page: PageId, intent?: Intent) => void;
  switchAccount: (provider: ProviderOverview, account: string) => Promise<unknown>;
  connect: (alias: string) => Promise<unknown>;
  setHostKey: (alias: string, key: KeyInfo) => Promise<unknown>;
  testActive: () => Promise<unknown>;
}

export function buildCommands(d: CommandDeps): PaletteCommand[] {
  const commands: PaletteCommand[] = [];

  for (const p of d.providers) {
    for (const a of p.accounts) {
      if (a.active) continue;
      commands.push({
        id: `switch:${a.id}`,
        group: 'Switch account',
        label: `${p.name}: use ${a.name}`,
        detail: p.active ? `currently ${p.active}` : 'no active account',
        icon: ArrowRightLeft,
        keywords: `${p.id} ${p.hosts.join(' ')} ${a.gitEmail}`,
        run: () => d.switchAccount(p, a.name),
      });
    }
  }

  for (const h of d.hosts) {
    commands.push({
      id: `connect:${h.alias}`,
      group: 'Connect',
      label: `ssh ${h.alias}`,
      detail: [h.user, h.hostName].filter(Boolean).join('@'),
      icon: SquareTerminal,
      keywords: h.comment,
      run: () => d.connect(h.alias),
    });
  }

  for (const h of d.hosts) {
    for (const k of d.keys) {
      if (h.identityFile && k.path && h.identityFile.replace(/\\/g, '/').endsWith(`/${k.name}`)) continue;
      commands.push({
        id: `hostkey:${h.alias}:${k.name}`,
        group: 'Host key',
        label: `${h.alias}: use key ${k.name}`,
        icon: KeyRound,
        keywords: 'switch identityfile',
        run: () => d.setHostKey(h.alias, k),
      });
    }
  }

  const actions: [string, string, ComponentType<{ size?: number }>, () => void | Promise<unknown>][] = [
    ['Test active accounts', 'ssh -T', Activity, d.testActive],
    ['Add git account', 'new account', Plus, () => d.navigate('accounts', 'add-account')],
    ['Add host', 'new server', Plus, () => d.navigate('hosts', 'add-host')],
    ['Generate SSH key', 'new key', KeyRound, () => d.navigate('keys', 'generate-key')],
    ['Scan host keys', 'known_hosts trust', Radar, () => d.navigate('known-hosts', 'scan-host')],
    ['Edit raw SSH config', '~/.ssh/config', FileCode2, () => d.navigate('hosts', 'raw-config')],
  ];
  for (const [label, keywords, icon, run] of actions) {
    commands.push({ id: `action:${label}`, group: 'Actions', label, icon, keywords, run });
  }

  for (const r of ROUTES) {
    commands.push({ id: `goto:${r.id}`, group: 'Go to', label: r.label, icon: r.icon, keywords: 'page open', run: () => d.navigate(r.id) });
  }
  return commands;
}

/** Every whitespace-separated term must appear somewhere in the command's text. */
export function filterCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return commands.filter((c) => c.group !== 'Host key');
  return commands.filter((c) => {
    const text = `${c.group} ${c.label} ${c.detail ?? ''} ${c.keywords ?? ''}`.toLowerCase();
    return terms.every((t) => text.includes(t));
  });
}
