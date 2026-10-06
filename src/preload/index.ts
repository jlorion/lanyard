/**
 * Preload: the only bridge between the sandboxed renderer and the main
 * process. It exposes a single generic `invoke` plus two event subscriptions;
 * which methods exist is decided (and validated) by the main process.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC_CHANNELS, type AppCommand, type ChangeTopic, type IpcResponse, type NavigateRequest, type PreloadBridge } from '../shared/ipc';

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const bridge: PreloadBridge = {
  invoke: (namespace, method, args) => ipcRenderer.invoke(IPC_CHANNELS.invoke, namespace, method, args) as Promise<IpcResponse>,
  onChanged: (listener) => subscribe<ChangeTopic[]>(IPC_CHANNELS.changed, listener),
  onNavigate: (listener) => subscribe<NavigateRequest>(IPC_CHANNELS.navigate, listener),
  onCommand: (listener) => subscribe<AppCommand>(IPC_CHANNELS.command, listener),
};

contextBridge.exposeInMainWorld('lanyard', bridge);
