import path from 'node:path';
import { app, nativeImage, type NativeImage } from 'electron';

/** resources/ lives next to package.json both in dev and inside app.asar. */
export function resourcePath(name: string): string {
  return path.join(app.getAppPath(), 'resources', name);
}

export function appIcon(): NativeImage {
  return nativeImage.createFromPath(resourcePath('icon.png'));
}

/** macOS menu-bar icons must be monochrome template images. */
export function trayIcon(): NativeImage {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(resourcePath('trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  // tray@2x.png is picked up automatically on high-DPI displays.
  return nativeImage.createFromPath(resourcePath('tray.png'));
}
