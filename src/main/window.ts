/** The single application window, which hides to the tray instead of closing. */

import path from 'node:path';
import { BrowserWindow, Notification, shell } from 'electron';
import { IPC_CHANNELS } from '../shared/ipc';
import { appIcon } from './assets';

export interface MainWindowOptions {
  /** Whether closing the window should hide it to the tray (read on every close). */
  hideOnClose: () => boolean;
  /** Called when a close was turned into a hide but the app should quit instead. */
  onCloseRequested: () => void;
}

export class MainWindow {
  private win: BrowserWindow | null = null;
  private ready = false;
  private notifiedHidden = false;
  /** Set right before quitting so the close handler lets the window go. */
  quitting = false;

  constructor(private readonly options: MainWindowOptions) {}

  private create(): BrowserWindow {
    const win = new BrowserWindow({
      width: 1180,
      height: 780,
      minWidth: 860,
      minHeight: 560,
      show: false,
      title: 'SSH Manager',
      icon: appIcon(),
      backgroundColor: '#0f1117',
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    // Never let the renderer navigate away or open windows; https links go to the browser.
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) void shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('will-navigate', (event) => event.preventDefault());

    win.on('close', (event) => {
      if (this.quitting) return;
      if (!this.options.hideOnClose()) {
        this.options.onCloseRequested();
        return;
      }
      event.preventDefault();
      win.hide();
      this.notifyStillRunning();
    });
    win.once('ready-to-show', () => { this.ready = true; });
    win.on('closed', () => {
      this.win = null;
      this.ready = false;
    });

    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (devUrl) void win.loadURL(devUrl);
    else void win.loadFile(path.join(__dirname, '../renderer/index.html'));
    return win;
  }

  private notifyStillRunning(): void {
    if (this.notifiedHidden || !Notification.isSupported()) return;
    this.notifiedHidden = true;
    new Notification({
      title: 'SSH Manager is still running',
      body: 'It lives in the system tray. Right-click the tray icon to switch accounts or quit.',
      icon: appIcon(),
    }).show();
  }

  show(page?: string): void {
    if (!this.win) this.win = this.create();
    const win = this.win;
    const reveal = () => {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (page) win.webContents.send(IPC_CHANNELS.navigate, page);
    };
    if (this.ready) reveal();
    else win.once('ready-to-show', reveal);
  }

  toggle(): void {
    if (this.win?.isVisible() && this.win.isFocused()) this.win.hide();
    else this.show();
  }

  send(channel: string, payload: unknown): void {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, payload);
  }

  get browserWindow(): BrowserWindow | null {
    return this.win;
  }
}
