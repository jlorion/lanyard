/**
 * System tray: stays alive while the window is hidden and offers one-click
 * account switching, quick connect and account tests.
 */

import { Menu, Notification, Tray, type MenuItemConstructorOptions } from 'electron';
import * as core from '../core';
import { appIcon, trayIcon } from './assets';
import type { MainWindow } from './window';
import type { ProviderOverview } from '../shared/types';

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
    this.tray.setToolTip('SSH Manager');
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
    return ['SSH Manager', ...active].join('\n');
  }

  private template(providers: ProviderOverview[]): MenuItemConstructorOptions[] {
    const { window } = this.deps;
    return [
      { label: 'Open SSH Manager', click: () => window.show() },
      { type: 'separator' },
      ...(providers.length
        ? providers.map((p) => this.providerMenu(p))
        : [{ label: 'No git accounts yet', enabled: false }]),
      { label: 'Test active accounts', enabled: providers.some((p) => p.active), click: () => void this.testActive(providers) },
      { type: 'separator' },
      { label: 'Quick connect', submenu: this.connectMenu() },
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
      { label: 'Quit SSH Manager', click: () => this.deps.quit() },
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

  private connectMenu(): MenuItemConstructorOptions[] {
    let hosts: { alias: string; hostName: string }[] = [];
    try {
      hosts = core.hosts.connectable().filter((h) => !h.managed);
    } catch {
      // unreadable config - the window will show the error
    }
    if (!hosts.length) return [{ label: 'No hosts in ~/.ssh/config', enabled: false }];
    return hosts.slice(0, 30).map((h) => ({
      label: h.hostName ? `${h.alias}  →  ${h.hostName}` : h.alias,
      click: () => this.deps.connect(h.alias),
    }));
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
