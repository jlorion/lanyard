import { useCallback, useState } from 'react';

/**
 * useState backed by localStorage, for per-machine UI preferences such as
 * collapsed panels. Falls back to in-memory state when storage is unavailable.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (update: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (update: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const next = typeof update === 'function' ? (update as (p: T) => T)(prev) : update;
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // storage unavailable
        }
        return next;
      });
    },
    [key],
  );

  return [value, set];
}
