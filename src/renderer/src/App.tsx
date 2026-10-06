import { useEffect, useState } from 'react';
import { api, errorMessage } from './lib/api';
import type { AppInfo } from '../../shared/ipc';

/** Temporary shell; replaced by the full UI in the next stage. */
export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.app.info().then(setInfo, (err) => setError(errorMessage(err)));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24, color: '#e5e7eb', background: '#0f1117', minHeight: '100vh' }}>
      <h1>SSH Manager</h1>
      {error && <p style={{ color: '#f87171' }}>{error}</p>}
      {info && <pre>{JSON.stringify(info, null, 2)}</pre>}
    </main>
  );
}
