import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { KeyNameCheck } from '../../../shared/types';

/**
 * Live check of a key file name against ~/.ssh (debounced). Returns null while
 * a check is pending so callers can avoid flashing stale results.
 */
export function useKeyNameCheck(name: string, enabled = true): KeyNameCheck | null {
  const [result, setResult] = useState<KeyNameCheck | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setResult(null);
    let cancelled = false;
    const timer = setTimeout(() => {
      api.keys.checkName(name).then((r) => !cancelled && setResult(r), () => {});
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, enabled]);

  return enabled ? result : null;
}
