/**
 * The application menu (File, Edit, View, Go, History, Help). The window has
 * no menu bar - the title bar's menu button pops this up - but setting it as
 * the application menu also makes its accelerators (Ctrl+Q, Ctrl+, ...) work.
 *
 * Items that only change the UI are handed to the renderer: navigation goes
 * through MainWindow.show(page, intent); palette and history through
 * MainWindow.command(). Shortcuts the renderer already handles (Ctrl+K,
 * Ctrl+1-8, Alt+Left/Right) are shown here but not registered twice.
 */

import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';
import * as core from '../core';
import type { MainWindow } from './window';

const PAGES: [label: string, page: string][] = [
  ['Overview', 'overview'],
  ['Git accounts', 'accounts'],
  ['Hosts', 'hosts'],
  ['Keys', 'keys'],
  ['ssh-agent', 'agent'],
  ['Known hosts', 'known-hosts'],
  ['Backups', 'backups'],
  ['Settings', 'settings'],
];

export interface AppMenuDeps {
  window: MainWindow;
  quit: () => void;
}

export function buildAppMenu({ window, quit }: AppMenuDeps): Menu {
  const isMac = process.platform === 'darwin';
  const dev = !app.isPackaged;
  // Shown in the menu for discoverability; the renderer handles the key itself.
  const shown = (accelerator: string) => ({ accelerator, registerAccelerator: false });

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Add Git Account…', accelerator: 'CmdOrCtrl+N', click: () => window.show('accounts', 'add-account') },
        { label: 'Add Host…', accelerator: 'CmdOrCtrl+Shift+N', click: () => window.show('hosts', 'add-host') },
        { label: 'Generate SSH Key…', click: () => window.show('keys', 'generate-key') },
        { label: 'Scan Host Keys…', click: () => window.show('known-hosts', 'scan-host') },
        { type: 'separator' },
        { label: 'Edit Raw SSH Config', click: () => window.show('hosts', 'raw-config') },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => window.show('settings') },
        { type: 'separator' },
        { label: 'Close Window', accelerator: 'CmdOrCtrl+W', role: 'close' }, // hides to the tray
        ...(isMac ? [] : [{ label: 'Quit Lanyard', accelerator: 'CmdOrCtrl+Q', click: quit }]),
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Command Palette…', ...shown('CmdOrCtrl+K'), click: () => window.command('palette') },
        { type: 'separator' },
        // Zoom keys are handled by the window (see zoom.ts), which matches the
        // typed character on any layout; the menu only shows the shortcuts.
        { role: 'resetZoom', ...shown('CmdOrCtrl+0') },
        { role: 'zoomIn', ...shown('CmdOrCtrl+Plus') },
        { role: 'zoomOut', ...shown('CmdOrCtrl+-') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(dev ? [{ type: 'separator' as const }, { role: 'reload' as const }, { role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: 'Go',
      submenu: PAGES.map(([label, page], i) => ({ label, ...shown(`CmdOrCtrl+${i + 1}`), click: () => window.show(page) })),
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', ...shown('Alt+Left'), click: () => window.command('back') },
        { label: 'Forward', ...shown('Alt+Right'), click: () => window.command('forward') },
      ],
    },
    {
      role: 'help',
      submenu: [
        { label: 'About Lanyard', click: () => window.show('settings', 'about') },
        { label: 'Command Line Tool', click: () => window.show('settings') },
        { type: 'separator' },
        { label: 'Open SSH Folder', click: () => void shell.openPath(core.paths.sshDir) },
        { label: 'Open Lanyard Data Folder', click: () => void shell.openPath(core.paths.dataDir) },
        { label: 'Backups', click: () => window.show('backups') },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
