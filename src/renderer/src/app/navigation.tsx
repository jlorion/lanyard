/**
 * Page navigation plus one-shot "intents" (e.g. open the Add host dialog),
 * so the command palette and shortcuts can drive any page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isPageId, type PageId } from './pages';

export type Intent = 'add-account' | 'add-host' | 'generate-key' | 'scan-host' | 'raw-config';

interface Navigation {
  page: PageId;
  navigate: (page: PageId, intent?: Intent) => void;
  intent: Intent | null;
  clearIntent: () => void;
}

const NavigationContext = createContext<Navigation | null>(null);
const PAGE_KEY = 'lanyard.page';

function initialPage(): PageId {
  try {
    const saved = localStorage.getItem(PAGE_KEY);
    if (saved && isPageId(saved)) return saved;
  } catch {
    // storage unavailable
  }
  return 'overview';
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<PageId>(initialPage);
  const [intent, setIntent] = useState<Intent | null>(null);

  const navigate = useCallback((next: PageId, nextIntent?: Intent) => {
    setPage(next);
    setIntent(nextIntent ?? null);
  }, []);
  const clearIntent = useCallback(() => setIntent(null), []);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // storage unavailable
    }
  }, [page]);

  // The tray can ask the window to open on a specific page.
  useEffect(() => window.lanyard.onNavigate((p) => isPageId(p) && navigate(p)), [navigate]);

  const value = useMemo(() => ({ page, navigate, intent, clearIntent }), [page, navigate, intent, clearIntent]);
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): Navigation {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used inside <NavigationProvider>');
  return ctx;
}

/** Run `handler` once when the page is opened with `wanted` as its intent. */
export function useIntent(wanted: Intent, handler: () => void): void {
  const { intent, clearIntent } = useNavigation();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (intent !== wanted) return;
    clearIntent();
    ref.current();
  }, [intent, wanted, clearIntent]);
}
