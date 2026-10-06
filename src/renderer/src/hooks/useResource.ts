import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/api';
import type { ChangeTopic } from '../../../shared/ipc';

export interface Resource<T> {
  data: T | undefined;
  error: string;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * Load data from the main process and reload it whenever one of `topics`
 * changes on disk (the main process watches ~/.ssh and ~/.lanyard).
 */
export function useResource<T>(load: () => Promise<T>, topics: ChangeTopic[] = []): Resource<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const topicKey = topics.join(',');
  useEffect(() => {
    if (!topicKey) return;
    const wanted = topicKey.split(',');
    return window.lanyard.onChanged((changed) => {
      if (changed.some((t) => wanted.includes(t))) void reload();
    });
  }, [topicKey, reload]);

  return { data, error, loading, reload };
}
