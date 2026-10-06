/**
 * Ctrl/Cmd + "=", "+", "-", "0" (main row or numpad) zoom the window.
 *
 * Menu accelerators can't express this reliably: Electron's zoomIn default,
 * CmdOrCtrl+Plus, means Ctrl+Shift+= on most layouts, and the key that types
 * "=" or "+" differs per keyboard layout. Matching the typed character here
 * works everywhere.
 */

import type { Input, WebContents } from 'electron';

const STEP = 0.5; // zoom levels: 0 = 100%, each step ~ 10%
const MIN = -3;
const MAX = 5;

export type ZoomAction = 'in' | 'out' | 'reset';

/** Which zoom action a key press asks for, if any. */
export function zoomActionFor(
  input: Pick<Input, 'type' | 'key' | 'code' | 'control' | 'meta' | 'alt'>,
  isMac = process.platform === 'darwin',
): ZoomAction | null {
  if (input.type !== 'keyDown' || input.alt || !(isMac ? input.meta : input.control)) return null;
  if (input.key === '=' || input.key === '+' || input.code === 'NumpadAdd') return 'in';
  if (input.key === '-' || input.key === '_' || input.code === 'NumpadSubtract') return 'out';
  if (input.key === '0' || input.code === 'Numpad0') return 'reset';
  return null;
}

export function applyZoom(contents: WebContents, action: ZoomAction): void {
  const level = contents.getZoomLevel();
  if (action === 'reset') contents.setZoomLevel(0);
  else contents.setZoomLevel(Math.min(MAX, Math.max(MIN, level + (action === 'in' ? STEP : -STEP))));
}

/** Handle the zoom shortcuts for a window's contents. */
export function handleZoomKeys(contents: WebContents): void {
  contents.on('before-input-event', (event, input) => {
    const action = zoomActionFor(input);
    if (!action) return;
    event.preventDefault();
    applyZoom(contents, action);
  });
}
