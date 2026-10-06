import { useEffect, useState } from 'react';
import { api, errorMessage } from './lib/api';
import { Sidebar } from './app/Sidebar';
import { Topbar } from './app/Topbar';
import { ROUTES } from './app/routes';
import { AppInfoProvider } from './app/AppInfoContext';
import { NavigationProvider, useNavigation } from './app/navigation';
import { WorkspaceProvider } from './app/workspace';
import { AppearanceProvider } from './app/appearance';
import { ToastProvider } from './components/feedback/ToastProvider';
import { ConfirmProvider } from './components/feedback/ConfirmProvider';
import { Callout } from './components/ui/Feedback';
import { CommandPalette } from './features/palette/CommandPalette';
import type { AppInfo } from '../../shared/ipc';

function Shell({ info }: { info: AppInfo }) {
  const { page, navigate } = useNavigation();
  const [palette, setPalette] = useState<{ query: string } | null>(null);

  // Ctrl/Cmd+K toggles the palette, Ctrl/Cmd+1..8 jump between pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => (p ? null : { query: '' }));
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= ROUTES.length) {
        e.preventDefault();
        navigate(ROUTES[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const Page = ROUTES.find((r) => r.id === page)!.component;
  return (
    <div className="app">
      <Sidebar version={info.version} />
      <div className="workspace">
        <Topbar onSearch={(query = '') => setPalette({ query })} />
        <main className="main">
          <div className="page" key={page}>
            <Page />
          </div>
        </main>
      </div>
      {palette && <CommandPalette initialQuery={palette.query} onClose={() => setPalette(null)} />}
    </div>
  );
}

export function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.app.info().then(setInfo, (err) => setError(errorMessage(err)));
  }, []);

  if (error) return <div className="page"><Callout tone="danger">{error}</Callout></div>;
  if (!info) return null;

  return (
    <AppInfoProvider value={info}>
      <AppearanceProvider>
        <ToastProvider>
          <ConfirmProvider>
            <NavigationProvider>
              <WorkspaceProvider>
                <Shell info={info} />
              </WorkspaceProvider>
            </NavigationProvider>
          </ConfirmProvider>
        </ToastProvider>
      </AppearanceProvider>
    </AppInfoProvider>
  );
}
