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

const APP_ID = 'dev.riomar.sshmanager';

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
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null);

    registerIpc(createApi({
      window,
      onSettingsChanged: () => {
        applyLaunchAtLogin(core.settings.get().launchAtLogin);
        tray?.refresh();
      },
    }));

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

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setAppUserModelId(APP_ID); // required for Windows notifications
  bootstrap();
}
