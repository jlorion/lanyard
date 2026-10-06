/**
 * Page navigation plus one-shot "intents" (e.g. open the Add host dialog),
 * so the command palette and shortcuts can drive any page.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { isPageId, type PageId } from './pages';

export const INTENTS = ['add-account', 'add-host', 'generate-key', 'scan-host', 'raw-config', 'about'] as const;
export type Intent = (typeof INTENTS)[number];

const isIntent = (v: unknown): v is Intent => (INTENTS as readonly unknown[]).includes(v);

interface Navigation {
  page: PageId;
  navigate: (page: PageId, intent?: Intent) => void;
  intent: Intent | null;
  clearIntent: () => void;
  canGoBack: boolean;
  canGoForward: boolean;
  back: () => void;
  forward: () => void;
}

interface History {
  stack: PageId[];
  index: number;
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
  // Browser-style history: navigating drops anything "forward" of the current page.
  const [history, setHistory] = useState<History>(() => ({ stack: [initialPage()], index: 0 }));
  const [intent, setIntent] = useState<Intent | null>(null);
  const page = history.stack[history.index];

  const navigate = useCallback((next: PageId, nextIntent?: Intent) => {
    setHistory((h) => (h.stack[h.index] === next
      ? h
      : { stack: [...h.stack.slice(0, h.index + 1), next].slice(-50), index: Math.min(h.index + 1, 49) }));
    setIntent(nextIntent ?? null);
  }, []);
  const back = useCallback(() => setHistory((h) => (h.index > 0 ? { ...h, index: h.index - 1 } : h)), []);
  const forward = useCallback(() => setHistory((h) => (h.index < h.stack.length - 1 ? { ...h, index: h.index + 1 } : h)), []);
  const clearIntent = useCallback(() => setIntent(null), []);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_KEY, page);
    } catch {
      // storage unavailable
    }
  }, [page]);

  // The tray and the app menu can open a page, optionally with an intent.
  useEffect(() => window.lanyard.onNavigate(({ page: p, intent: i }) => {
    if (isPageId(p)) navigate(p, isIntent(i) ? i : undefined);
  }), [navigate]);

  const value = useMemo(() => ({
    page,
    navigate,
    intent,
    clearIntent,
    canGoBack: history.index > 0,
    canGoForward: history.index < history.stack.length - 1,
    back,
    forward,
  }), [page, navigate, intent, clearIntent, history, back, forward]);
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
