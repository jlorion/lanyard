/// <reference types="vite/client" />

import type { PreloadBridge } from '../../shared/ipc';

declare global {
  interface Window {
    sshm: PreloadBridge;
  }
}
