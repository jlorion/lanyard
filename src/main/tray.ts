/**
 * System tray: stays alive while the window is hidden and offers one-click
 * account switching, per-host key switching, quick connect and tests.
 */

import { Menu, Notification, Tray, type MenuItemConstructorOptions } from 'electron';
import * as core from '../core';
import { appIcon, trayIcon } from './assets';
import type { MainWindow } from './window';
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
      ...(providers.length
        ? providers.map((p) => this.providerMenu(p))
        : [{ label: 'No git accounts yet', enabled: false }]),
      { label: 'Test active accounts', enabled: providers.some((p) => p.active), click: () => void this.testActive(providers) },
      { type: 'separator' },
      { label: 'Hosts', submenu: this.hostsMenu() },
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
      submenu: [
        ...p.accounts.map((a): MenuItemConstructorOptions => ({
          label: a.name + (a.lastTest?.username ? `  (${a.lastTest.username})` : ''),
          type: 'radio',
          checked: a.active,
          click: () => void this.switchTo(p, a.name),
        })),
        { type: 'separator' },
        { label: 'No active account', type: 'radio', checked: !p.active, click: () => void this.switchTo(p, null) },
      ],
    };
  }

  /** One submenu per host: connect, test, and a radio list to switch its SSH key. */
  private hostsMenu(): MenuItemConstructorOptions[] {
    let hosts: HostEntry[] = [];
    let keys: KeyInfo[] = [];
    try {
      hosts = core.hosts.connectable().filter((h) => !h.managed);
      keys = core.keys.list().filter((k) => k.hasPrivate);
    } catch {
      // unreadable config - the window will show the error
    }
    if (!hosts.length) return [{ label: 'No hosts in ~/.ssh/config', enabled: false }];

    return hosts.slice(0, 30).map((h): MenuItemConstructorOptions => {
      const current = keys.find((k) => core.keys.isKeyAt(k, h.identityFile));
      const keyLabel = current?.name ?? (h.identityFile ? h.identityFile.split(/[\\/]/).pop() : 'default keys');
      return {
        label: `${h.alias}  ·  ${keyLabel}`,
        submenu: [
          { label: `Connect to ${h.hostName || h.alias}`, click: () => this.deps.connect(h.alias) },
          { label: 'Test login', click: () => void this.testHost(h.alias) },
          { type: 'separator' },
          { label: 'SSH key', enabled: false },
          ...keys.slice(0, 25).map((k): MenuItemConstructorOptions => ({
            label: `${k.name}${k.encrypted ? '  🔒' : ''}`,
            type: 'radio',
            checked: k === current,
            click: () => void this.setHostKey(h.alias, k),
          })),
          ...(h.identityFile && !current
            ? [{ label: `${keyLabel} (not in ~/.ssh)`, type: 'radio', checked: true, enabled: false } as MenuItemConstructorOptions]
            : []),
          { label: 'SSH default keys', type: 'radio', checked: !h.identityFile, click: () => void this.setHostKey(h.alias, null) },
        ],
      };
    });
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
      notify(p.name, r.active ? `Now using "${r.active}"${r.gitIdentityApplied ? ' (git identity updated)' : ''}` : 'No active account');
    } catch (err) {
      notify(`${p.name}: switch failed`, (err as Error).message);
    }
    this.refresh();
  }

  private async testActive(providers: ProviderOverview[]): Promise<void> {
    const results = await Promise.all(
      providers.filter((p) => p.active).map((p) =>
        core.accounts.test(p.id).catch((err: Error) => ({ ok: false, account: p.id, message: err.message }))),
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
