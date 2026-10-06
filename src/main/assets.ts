import path from 'node:path';
import { app, nativeImage, type NativeImage } from 'electron';

/** resources/ lives next to package.json both in dev and inside app.asar. */
export function resourcePath(name: string): string {
  return path.join(app.getAppPath(), 'resources', name);
}

function load(name: string): NativeImage {
  const img = nativeImage.createFromPath(resourcePath(name));
  if (img.isEmpty()) console.warn(`icon not found or unreadable: ${resourcePath(name)}`);
  return img;
}

/** Window / taskbar icon. Windows picks the right size from the multi-size .ico. */
export function appIcon(): NativeImage {
  return load(process.platform === 'win32' ? 'icon.ico' : 'icon.png');
}

/** macOS menu-bar icons must be monochrome template images. */
export function trayIcon(): NativeImage {
  if (process.platform === 'darwin') {
    const img = load('trayTemplate.png');
    img.setTemplateImage(true);
    return img;
  }
  // tray@2x.png is picked up automatically on high-DPI displays.
  return load('tray.png');
}
