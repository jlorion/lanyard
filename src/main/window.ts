/** The single application window, which hides to the tray instead of closing. */

import path from 'node:path';
import { BrowserWindow, Notification, shell } from 'electron';
import { IPC_CHANNELS, type AppCommand } from '../shared/ipc';
import { appIcon } from './assets';
import { rendererSource } from './security';
import { handleZoomKeys } from './zoom';

export interface MainWindowOptions {
  /** Whether closing the window should hide it to the tray (read on every close). */
  hideOnClose: () => boolean;
  /** Called when a close was turned into a hide but the app should quit instead. */
  onCloseRequested: () => void;
}

/**
 * Height of the native window-button overlay: --topbar-height (52px) minus the
 * top bar's 1px bottom border, so the border runs under the buttons too.
 */
const TITLE_BAR_HEIGHT = 51;

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
      title: 'Lanyard',
      icon: appIcon(),
      backgroundColor: '#17181c',
      autoHideMenuBar: true,
      // Custom title bar: the renderer's top bar is the drag region. Windows and
      // Linux keep native window buttons drawn over it; macOS keeps its traffic lights.
      titleBarStyle: 'hidden',
      ...(process.platform === 'darwin'
        ? { trafficLightPosition: { x: 18, y: 18 } }
        : { titleBarOverlay: { color: '#17181c', symbolColor: '#e8e8ea', height: TITLE_BAR_HEIGHT } }),
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
    handleZoomKeys(win.webContents);

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
    win.once('ready-to-show', () => {
      this.ready = true;
    });
    win.on('closed', () => {
      this.win = null;
      this.ready = false;
    });

    const source = rendererSource();
    if (source.kind === 'url') void win.loadURL(source.url);
    else void win.loadFile(source.file);
    return win;
  }

  private notifyStillRunning(): void {
    if (this.notifiedHidden || !Notification.isSupported()) return;
    this.notifiedHidden = true;
    new Notification({
      title: 'Lanyard is still running',
      body: 'It lives in the system tray. Right-click the tray icon to switch accounts or quit.',
      icon: appIcon(),
    }).show();
  }

  show(page?: string, intent?: string): void {
    if (!this.win) this.win = this.create();
    const win = this.win;
    const reveal = () => {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
      if (page) win.webContents.send(IPC_CHANNELS.navigate, { page, intent });
    };
    if (this.ready) reveal();
    else win.once('ready-to-show', reveal);
  }

  /** Recolour the native window buttons to match the renderer theme (Windows/Linux). */
  setTitleBarColors(color: string, symbolColor: string): void {
    if (process.platform === 'darwin' || !this.win || this.win.isDestroyed()) return;
    this.win.setTitleBarOverlay({ color, symbolColor, height: TITLE_BAR_HEIGHT });
  }

  /** Ask the renderer to perform an app-menu action (shows the window first). */
  command(command: AppCommand): void {
    this.show();
    this.send(IPC_CHANNELS.command, command);
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
