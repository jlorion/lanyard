/**
 * Pure zoom logic shared by tests and the renderer's zoom handler.
 * Ctrl/Cmd + "=", "+", "-", "0" (main row or numpad) zoom the window.
 * Extracted from the old Electron main src/main/zoom.ts.
 */

export const ZOOM_STEP = 0.5; // zoom levels: 0 = 100%, each step ~ 10%
export const ZOOM_MIN = -3;
export const ZOOM_MAX = 5;

export type ZoomAction = 'in' | 'out' | 'reset';

export interface ZoomKeyInput {
  type: string;
  key: string;
  code: string;
  control: boolean;
  meta: boolean;
  alt: boolean;
}

/** Which zoom action a key press asks for, if any. */
export function zoomActionFor(input: ZoomKeyInput, isMac: boolean): ZoomAction | null {
  if (input.type !== 'keyDown' || input.alt || !(isMac ? input.meta : input.control)) return null;
  if (input.key === '=' || input.key === '+' || input.code === 'NumpadAdd') return 'in';
  if (input.key === '-' || input.key === '_' || input.code === 'NumpadSubtract') return 'out';
  if (input.key === '0' || input.code === 'Numpad0') return 'reset';
  return null;
}

/** Next zoom level after an action, clamped to the allowed range. */
export function nextZoomLevel(level: number, action: ZoomAction): number {
  if (action === 'reset') return 0;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level + (action === 'in' ? ZOOM_STEP : -ZOOM_STEP)));
}

/** Tauri's setZoom takes a scale factor, not Chromium's zoom level. */
export function zoomLevelToScale(level: number): number {
  // Chromium: each level multiplies size by 1.2^(level/... ) — approximated here
  // as 10% per half-step, matching the old app's perceived steps.
  return Math.pow(1.1, level / ZOOM_STEP);
}
