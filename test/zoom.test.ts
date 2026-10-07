import { describe, expect, it } from 'vitest';
import { zoomActionFor } from '../src/shared/zoom';

const key = (key: string, extra: Partial<Parameters<typeof zoomActionFor>[0]> = {}) =>
  ({ type: 'keyDown', key, code: '', control: true, meta: false, alt: false, ...extra }) as const;

describe('zoom shortcuts', () => {
  it('zooms in on Ctrl with "=" or "+" (with or without Shift) and the numpad', () => {
    expect(zoomActionFor(key('='), false)).toBe('in');
    expect(zoomActionFor(key('+'), false)).toBe('in');
    expect(zoomActionFor(key('+', { code: 'NumpadAdd' }), false)).toBe('in');
  });

  it('zooms out and resets', () => {
    expect(zoomActionFor(key('-'), false)).toBe('out');
    expect(zoomActionFor(key('-', { code: 'NumpadSubtract' }), false)).toBe('out');
    expect(zoomActionFor(key('0'), false)).toBe('reset');
  });

  it('uses Cmd on macOS and ignores everything else', () => {
    expect(zoomActionFor(key('=', { control: false, meta: true }), true)).toBe('in');
    expect(zoomActionFor(key('='), true)).toBeNull();
    expect(zoomActionFor(key('=', { control: false }), false)).toBeNull();
    expect(zoomActionFor(key('=', { alt: true }), false)).toBeNull();
    expect(zoomActionFor(key('=', { type: 'keyUp' }), false)).toBeNull();
    expect(zoomActionFor(key('k'), false)).toBeNull();
  });
});
