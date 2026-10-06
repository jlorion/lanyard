import { useCallback, useState } from 'react';
import { useToast } from '../components/feedback/ToastProvider';
import { errorMessage } from '../lib/api';

/**
 * Run async actions with per-key busy state and toast feedback.
 *   const { run, isBusy } = useTask();
 *   run('test:github:work', () => api.accounts.test('github', 'work'), (r) => r.message)
 */
export function useTask() {
  const toast = useToast();
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  const run = useCallback(
    async <T>(key: string, fn: () => Promise<T>, success?: string | ((result: T) => string)): Promise<T | undefined> => {
      setBusy((s) => new Set(s).add(key));
      try {
        const result = await fn();
        if (success) toast.success(typeof success === 'function' ? success(result) : success);
        return result;
      } catch (err) {
        toast.error(errorMessage(err));
        return undefined;
      } finally {
        setBusy((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [toast],
  );

  const isBusy = useCallback((key: string) => busy.has(key), [busy]);

  return { run, isBusy };
}
