/** Dispatches renderer calls on the single invoke channel to the API object. */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, type IpcResponse, type LanyardApi } from '../../shared/ipc';

type AnyFn = (...args: unknown[]) => Promise<unknown>;

function lookup(api: LanyardApi, namespace: unknown, method: unknown): AnyFn | null {
  if (typeof namespace !== 'string' || typeof method !== 'string') return null;
  if (!Object.hasOwn(api, namespace)) return null;
  const group = api[namespace as keyof LanyardApi] as unknown as Record<string, unknown>;
  if (!Object.hasOwn(group, method)) return null;
  const fn = group[method];
  return typeof fn === 'function' ? (fn as AnyFn) : null;
}

/** Only accept calls from our own renderer (file:// in production, the dev server in dev). */
function trustedSender(event: IpcMainInvokeEvent): boolean {
  const url = event.senderFrame?.url ?? '';
  const devUrl = process.env.ELECTRON_RENDERER_URL;
  return url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl));
}

export function registerIpc(api: LanyardApi): void {
  ipcMain.handle(IPC_CHANNELS.invoke, async (event, namespace: unknown, method: unknown, args: unknown): Promise<IpcResponse> => {
    if (!trustedSender(event)) return { ok: false, error: 'Untrusted sender' };
    const fn = lookup(api, namespace, method);
    if (!fn) return { ok: false, error: `Unknown method ${String(namespace)}.${String(method)}` };
    try {
      const data = await fn(...(Array.isArray(args) ? args : []));
      return { ok: true, data };
    } catch (err) {
      const e = err as Error & { code?: string };
      return { ok: false, error: e.message, code: e.code };
    }
  });
}
