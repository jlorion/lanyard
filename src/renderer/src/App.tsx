import { useEffect, useState } from 'react';
import { api, errorMessage } from './lib/api';
import { Sidebar } from './app/Sidebar';
import { ROUTES, isPageId, type PageId } from './app/routes';
import { AppInfoProvider } from './app/AppInfoContext';
import { ToastProvider } from './components/feedback/ToastProvider';
import { ConfirmProvider } from './components/feedback/ConfirmProvider';
import { Callout } from './components/ui/Feedback';
import type { AppInfo } from '../../shared/ipc';

const PAGE_KEY = 'sshm.page';

function initialPage(): PageId {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    if (saved && isPageId(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return 'accounts';
}

export function App() {
  const [page, setPage] = useState<PageId>(initialPage);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.app.info().then(setInfo, (err) => setError(errorMessage(err)));
  }, []);

  // The tray can ask the window to open on a specific page.
  useEffect(() => window.sshm.onNavigate((p) => isPageId(p) && setPage(p)), []);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // storage unavailable
    }
  }, [page]);

  if (error) return <div className="page"><Callout tone="danger">{error}</Callout></div>;
  if (!info) return null;

  const Page = ROUTES.find((r) => r.id === page)!.component;
  return (
    <AppInfoProvider value={info}>
      <ToastProvider>
        <ConfirmProvider>
          <div className="app">
            <Sidebar current={page} onNavigate={setPage} version={info.version} />
            <main className="main">
              <div className="page">
                <Page key={page} />
              </div>
            </main>
          </div>
        </ConfirmProvider>
      </ToastProvider>
    </AppInfoProvider>
  );
}
