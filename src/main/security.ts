/**
 * Process-wide Electron hardening. The renderer is our own bundled page and
 * the only thing allowed to reach the IPC API; nothing else may be loaded,
 * opened, embedded or granted a permission.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, session } from 'electron';

const RENDERER_FILE = path.join(__dirname, '../renderer/index.html');

/**
 * Where the window's page comes from: the bundled index.html, or the
 * electron-vite dev server during `npm run dev`. The dev server variable is
 * ignored in packaged builds, so an environment variable can never point the
 * app (and its IPC API) at another page.
 */
export function rendererSource(): { kind: 'file'; file: string } | { kind: 'url'; url: string } {
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return !app.isPackaged && devUrl ? { kind: 'url', url: devUrl } : { kind: 'file', file: RENDERER_FILE };
}

/** Is `url` our renderer page (ignoring query and hash)? */
export function isRendererUrl(url: string): boolean {
  let actual: URL;
  try {
    actual = new URL(url);
  } catch {
    return false;
  }
  const source = rendererSource();
  if (source.kind === 'url') return actual.origin === new URL(source.url).origin;
  if (actual.protocol !== 'file:') return false;
  const expected = new URL(pathToFileURL(source.file).href);
  const normalize = (u: URL) => decodeURIComponent(u.pathname).replace(/\/+/g, '/');
  // Windows paths are case-insensitive and Chromium may change the drive letter's case.
  return process.platform === 'win32'
    ? normalize(actual).toLowerCase() === normalize(expected).toLowerCase()
    : normalize(actual) === normalize(expected);
}

/** Apply to every web contents the app ever creates. Call before the first window. */
export function hardenSessions(): void {
  // Lanyard needs no camera, microphone, notifications-from-web, etc.
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('will-navigate', (event, url) => {
      if (!isRendererUrl(url)) event.preventDefault();
    });
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
}
