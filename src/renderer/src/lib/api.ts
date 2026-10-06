/**
 * Typed client for the main-process API. `api.accounts.use('github', 'work')`
 * becomes an invoke('accounts', 'use', [...]) round trip; failures are thrown
 * as ApiError with the original message and code.
 */

import type { ApiNamespace, LanyardApi } from '../../../shared/ipc';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function namespaceProxy(namespace: ApiNamespace): object {
  return new Proxy(
    {},
    {
      get: (_target, method) => {
        if (typeof method !== 'string') return undefined;
        return async (...args: unknown[]) => {
          const res = await window.lanyard.invoke(namespace, method, args);
          if (!res.ok) throw new ApiError(res.error, res.code);
          return res.data;
        };
      },
    },
  );
}

export const api = new Proxy({} as LanyardApi, {
  get: (_target, namespace) => (typeof namespace === 'string' ? namespaceProxy(namespace as ApiNamespace) : undefined),
});

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
