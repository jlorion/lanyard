/**
 * Renderer-side zoom (replaces the Electron main-process zoom handler).
 * Listens for the zoom shortcuts, applies them via Tauri's webview zoom, and
 * persists the level across restarts in localStorage.
 */

import { getCurrentWebview } from '@tauri-apps/api/webview';
import { nextZoomLevel, zoomActionFor, zoomLevelToScale } from '../../../shared/zoom';
import { read as readStored, write as writeStored } from './appearance';

const STORAGE_KEY = 'lanyard:zoom-level';

export function storedZoomLevel(): number {
  const raw = readStored(STORAGE_KEY);
  const n = raw === null ? 0 : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function installZoom(): void {
  let level = storedZoomLevel();
  const webview = getCurrentWebview();
  if (level !== 0) void webview.setZoom(zoomLevelToScale(level));

  window.addEventListener('keydown', (e) => {
    const action = zoomActionFor(
      { type: 'keyDown', key: e.key, code: e.code, control: e.ctrlKey, meta: e.metaKey, alt: e.altKey },
      navigator.userAgent.includes('Mac'),
    );
    if (!action) return;
    e.preventDefault();
    level = nextZoomLevel(level, action);
    writeStored(STORAGE_KEY, String(level));
    void webview.setZoom(zoomLevelToScale(level));
  });
}
