/**
 * System tray: stays alive while the window is hidden and offers one-click
 * account switching, per-host key switching, quick connect and tests.
 */

import { Menu, Notification, Tray, type MenuItemConstructorOptions } from 'electron';
import * as core from '../core';
import { appIcon, trayIcon } from './assets';
import type { MainWindow } from './window';
import { buildHostsMenu } from './tray-hosts-menu';
import type { HostEntry, KeyInfo, ProviderOverview } from '../shared/types';

export interface TrayDeps {
  window: MainWindow;
  connect: (alias: string) => void;
  setLaunchAtLogin: (enabled: boolean) => void;
  quit: () => void;
}

function notify(title: string, body: string): void {
  if (Notification.isSupported()) new Notification({ title, body, icon: appIcon() }).show();
}

export class TrayController {
  private readonly tray: Tray;

  constructor(private readonly deps: TrayDeps) {
    this.tray = new Tray(trayIcon());
    this.tray.setToolTip('Lanyard');
    // Windows/Linux convention: left click opens the window, right click the menu.
    this.tray.on('click', () => deps.window.toggle());
    this.refresh();
  }

  /** Rebuild the menu from the current state on disk. */
  refresh(): void {
    let providers: ProviderOverview[] = [];
    try {
      providers = core.accounts.overview().filter((p) => p.accounts.length);
    } catch (err) {
      console.error('tray: could not load accounts', err);
    }
    this.tray.setToolTip(this.tooltip(providers));
    this.tray.setContextMenu(Menu.buildFromTemplate(this.template(providers)));
  }

  private tooltip(providers: ProviderOverview[]): string {
    const active = providers.filter((p) => p.active).map((p) => `${p.name}: ${p.active}`);
    return ['Lanyard', ...active].join('\n');
  }

  private template(providers: ProviderOverview[]): MenuItemConstructorOptions[] {
    const { window } = this.deps;
    return [
      { label: 'Open Lanyard', click: () => window.show() },
      { type: 'separator' },
      ...(providers.length ? providers.map((p) => this.providerMenu(p)) : [{ label: 'No git accounts yet', enabled: false }]),
      { label: 'Test active accounts', enabled: providers.some((p) => p.active), click: () => void this.testActive(providers) },
      { type: 'separator' },
      { label: 'Hosts', submenu: this.hostsMenu(providers) },
      { type: 'separator' },
      { label: 'Manage hosts…', click: () => window.show('hosts') },
      { label: 'Manage keys…', click: () => window.show('keys') },
      { label: 'ssh-agent…', click: () => window.show('agent') },
      { type: 'separator' },
      {
        label: 'Start at login',
        type: 'checkbox',
        checked: core.settings.get().launchAtLogin,
        click: (item) => this.deps.setLaunchAtLogin(item.checked),
      },
      { label: 'Quit Lanyard', click: () => this.deps.quit() },
    ];
  }

  private providerMenu(p: ProviderOverview): MenuItemConstructorOptions {
    return {
      label: `${p.name}  ·  ${p.active ?? 'none'}`,
      // One radio group: Electron starts a new group after a separator and
      // auto-checks the first item of a group with nothing checked, which made
      // "none" look selected next to the real active account.
      submenu: [
        ...p.accounts.map((a): MenuItemConstructorOptions => ({
          label: a.name + (a.lastTest?.username ? `  (${a.lastTest.username})` : ''),
          type: 'radio',
          checked: a.active,
          click: () => {
            if (!a.active) void this.switchTo(p, a.name);
          },
        })),
        {
          label: 'None (use default SSH keys)',
          type: 'radio',
          checked: !p.active,
          click: () => {
            if (p.active) void this.switchTo(p, null);
          },
        },
      ],
    };
  }

  /** Servers and git hosts, mirroring the Hosts page (built by tray-hosts-menu.ts). */
  private hostsMenu(providers: ProviderOverview[]): MenuItemConstructorOptions[] {
    let hosts: HostEntry[];
    let keys: KeyInfo[];
    try {
      hosts = core.hosts.list();
      keys = core.keys.list().filter((k) => k.hasPrivate);
    } catch {
      return [{ label: 'Could not read ~/.ssh/config', enabled: false }];
    }
    return buildHostsMenu(
      { hosts, keys, providers, isKeyAt: core.keys.isKeyAt },
      {
        connect: (alias) => this.deps.connect(alias),
        test: (alias) => void this.testHost(alias),
        setKey: (alias, key) => void this.setHostKey(alias, key),
        useAccount: (p, name) => void this.switchTo(p, name),
        addServer: () => this.deps.window.show('hosts', 'add-host'),
      },
    );
  }

  private async setHostKey(alias: string, key: KeyInfo | null): Promise<void> {
    try {
      core.hosts.setKey(alias, key ? key.path : null);
      notify(alias, key ? `Now uses ${key.name}` : 'Now uses the default SSH keys');
    } catch (err) {
      notify(`${alias}: key switch failed`, (err as Error).message);
    }
    this.refresh();
  }

  private async testHost(alias: string): Promise<void> {
    try {
      const r = await core.hosts.test(alias);
      notify(`${r.ok ? '✔' : '✖'} ${alias}`, r.message);
    } catch (err) {
      notify(`${alias}: test failed`, (err as Error).message);
    }
  }

  private async switchTo(p: ProviderOverview, name: string | null): Promise<void> {
    try {
      const r = await core.accounts.use(p.id, name);
      notify(
        p.name,
        r.active
          ? `Now using "${r.active}"${r.gitIdentityApplied ? ' (git identity updated)' : ''}`
          : 'No active account - plain URLs use your default SSH keys',
      );
    } catch (err) {
      notify(`${p.name}: switch failed`, (err as Error).message);
    }
    this.refresh();
  }

  private async testActive(providers: ProviderOverview[]): Promise<void> {
    const results = await Promise.all(
      providers
        .filter((p) => p.active)
        .map((p) => core.accounts.test(p.id).catch((err: Error) => ({ ok: false, account: p.id, message: err.message }))),
    );
    const failed = results.filter((r) => !r.ok);
    notify(
      failed.length ? `${failed.length} account test(s) failed` : 'All active accounts work',
      results.map((r) => `${r.ok ? '✔' : '✖'} ${r.account}: ${r.message}`).join('\n'),
    );
    this.refresh();
  }

  destroy(): void {
    this.tray.destroy();
  }
}
