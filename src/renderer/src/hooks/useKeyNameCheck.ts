import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { KeyNameCheck } from '../../../shared/types';

/**
 * Live check of a key file name against ~/.ssh (debounced). Returns null while
 * a check is pending so callers can avoid flashing stale results.
 */
export function useKeyNameCheck(name: string, enabled = true): KeyNameCheck | null {
  // Tagged with the name it answers, so a result for an older name reads as pending.
  const [result, setResult] = useState<{ name: string; check: KeyNameCheck } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      api.keys.checkName(name).then(
        (check) => !cancelled && setResult({ name, check }),
        () => {},
      );
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, enabled]);

  return enabled && result?.name === name ? result.check : null;
}
