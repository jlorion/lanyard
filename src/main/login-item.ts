import { app } from 'electron';

export const HIDDEN_FLAG = '--hidden';

/** Register (or unregister) the app to start with the OS, hidden in the tray. */
export function applyLaunchAtLogin(enabled: boolean): void {
  // In development the executable is electron itself, so the app path must be passed too.
  const args = app.isPackaged ? [HIDDEN_FLAG] : [app.getAppPath(), HIDDEN_FLAG];
  app.setLoginItemSettings({ openAtLogin: enabled, args });
}
