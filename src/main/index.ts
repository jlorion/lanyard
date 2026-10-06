/**
 * Electron entry point: wires the window, tray, IPC and file watcher together.
 * The app keeps running in the tray after its window is closed.
 */

import { app, Menu } from 'electron';
import * as core from '../core';
import { IPC_CHANNELS } from '../shared/ipc';
import { MainWindow } from './window';
import { TrayController } from './tray';
import { watchFiles } from './watcher';
import { applyLaunchAtLogin, HIDDEN_FLAG } from './login-item';
import { createApi, openInTerminal } from './ipc/api';
import { registerIpc } from './ipc/register';
import { buildAppMenu } from './app-menu';
import * as cliInstall from './cli-install';
import { hardenSessions } from './security';

const APP_ID = 'dev.riomar.lanyard';

function bootstrap(): void {
  let tray: TrayController | null = null;
  let stopWatching: (() => void) | null = null;

  const quit = () => {
    window.quitting = true;
    app.quit();
  };

  const window = new MainWindow({
    hideOnClose: () => core.settings.get().closeToTray,
    onCloseRequested: quit,
  });

  const setLaunchAtLogin = (enabled: boolean) => {
    core.settings.update({ launchAtLogin: enabled });
    applyLaunchAtLogin(enabled);
    tray?.refresh();
  };

  app.on('second-instance', () => window.show());
  app.on('activate', () => window.show()); // macOS dock click
  app.on('before-quit', () => {
    window.quitting = true;
    stopWatching?.();
    tray?.destroy();
  });
  // The tray keeps the app alive; never quit just because no window is open.
  app.on('window-all-closed', () => {});

  void app.whenReady().then(() => {
    hardenSessions();
    // No visible menu bar (frameless window); the title bar's menu button pops
    // this up, and setting it here makes its accelerators work.
    Menu.setApplicationMenu(buildAppMenu({ window, quit }));

    registerIpc(
      createApi({
        window,
        onSettingsChanged: () => {
          applyLaunchAtLogin(core.settings.get().launchAtLogin);
          tray?.refresh();
        },
      }),
    );

    tray = new TrayController({
      window,
      connect: (alias) => openInTerminal('ssh', [alias], `ssh ${alias}`),
      setLaunchAtLogin,
      quit,
    });

    stopWatching = watchFiles((topics) => {
      window.send(IPC_CHANNELS.changed, topics);
      tray?.refresh();
    });

    const startHidden = process.argv.includes(HIDDEN_FLAG) || core.settings.get().startHidden;
    if (!startHidden) window.show();
  });
}

// A separate profile (single-instance lock, window state) lets a sandboxed
// instance - with LANYARD_SSH_DIR / LANYARD_HOME - run beside your real one.
if (process.env.LANYARD_USER_DATA) app.setPath('userData', process.env.LANYARD_USER_DATA);

// Installer / uninstaller hooks (build/installer.nsh): put the `lanyard` and
// `lny` commands on the PATH (or remove them) and exit - no window, no tray.
// Handled before the single-instance lock so it works while Lanyard is open.
const cliFlag = process.argv.find((a) => a === '--install-cli' || a === '--uninstall-cli');

if (cliFlag) {
  void app.whenReady().then(async () => {
    try {
      const status = cliFlag === '--install-cli' ? await cliInstall.install() : await cliInstall.uninstall();
      console.log(`lanyard ${cliFlag}: ${status.installed ? 'installed' : 'removed'} (${status.binDir})`);
      app.exit(0);
    } catch (err) {
      console.error(`lanyard ${cliFlag} failed:`, err);
      app.exit(1);
    }
  });
} else if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Windows ties taskbar icons and notifications to the App User Model ID. The
  // installer registers a Start-menu shortcut for APP_ID; in development no such
  // shortcut exists, and Windows would fall back to electron.exe's icon, so the
  // dev build keeps the default ID and the window icon wins.
  app.setName('Lanyard');
  if (app.isPackaged) app.setAppUserModelId(APP_ID);
  bootstrap();
}
