import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Menu, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useWorkspace } from './workspace';
import { useNavigation } from './navigation';
import { ProviderMark } from '../components/domain/ProviderMark';
import { ActionMenu } from '../components/ui/ActionMenu';
import type { ProviderOverview } from '../../../shared/types';

const isMac = navigator.userAgent.includes('Mac');
const shortcut = isMac ? '⌘K' : 'Ctrl K';
const CHIP_GAP = 6; // keep in sync with .identity-chips gap

/**
 * The custom title bar, laid out like Slack's: app menu and history on the
 * left, search centred on the window, active identities on the right.
 */
export function Topbar({ onSearch }: { onSearch: (query?: string) => void }) {
  const { providers } = useWorkspace();
  const { navigate, back, forward, canGoBack, canGoForward } = useNavigation();
  const active = providers.filter((p) => p.active);
  const menuButton = useRef<HTMLButtonElement>(null);

  // With a single account there is nothing to switch to, so open the accounts page instead.
  const open = (p: ProviderOverview) => (p.accounts.length > 1 ? onSearch(`${p.name}: use`) : navigate('accounts'));

  const showAppMenu = () => {
    const r = menuButton.current?.getBoundingClientRect();
    if (!r) return;
    // Menu coordinates are window DIPs; CSS pixels differ when the page is zoomed.
    const zoom = window.outerWidth / window.innerWidth || 1;
    void api.app.showAppMenu(r.left * zoom, (r.bottom + 4) * zoom);
  };

  // Show as many chips as fit; the rest fold into a "+N" menu. Widths come
  // from an invisible copy of every chip so the measurement never oscillates.
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(active.length);
  const signature = active.map((p) => `${p.id}:${p.active}`).join('|');

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;
    const compute = () => {
      const widths = [...measure.children].map((c) => (c as HTMLElement).offsetWidth);
      const moreWidth = widths.pop() ?? 0; // last child is the "+N" prototype
      // clientWidth includes the padding reserved for the native window buttons.
      const available = container.clientWidth - (parseFloat(getComputedStyle(container).paddingRight) || 0);
      let used = 0;
      let n = 0;
      for (let i = 0; i < widths.length; i++) {
        const width = widths[i] + (n ? CHIP_GAP : 0);
        const reserve = i < widths.length - 1 ? moreWidth + CHIP_GAP : 0; // room for "+N" if more follow
        if (used + width + reserve > available) break;
        used += width;
        n++;
      }
      setFit(n);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(container);
    return () => observer.disconnect();
  }, [signature]);

  const chip = (p: ProviderOverview) => (
    <button
      key={p.id}
      type="button"
      className="identity-chip"
      title={p.accounts.length > 1 ? `${p.name}: ${p.active} - click to switch` : `${p.name}: ${p.active}`}
      onClick={() => open(p)}
    >
      <ProviderMark id={p.id} name={p.name} color={p.color} size={20} />
      <span>{p.active}</span>
    </button>
  );

  const hidden = active.slice(fit);

  return (
    <header className="topbar">
      <div className="topbar-left">
        {!isMac && (
          <button ref={menuButton} type="button" className="topbar-icon" title="Menu" aria-label="Application menu" onClick={showAppMenu}>
            <Menu size={18} />
          </button>
        )}
        <button type="button" className="topbar-icon" title="Back (Alt+Left)" aria-label="Back" disabled={!canGoBack} onClick={back}>
          <ArrowLeft size={17} />
        </button>
        <button
          type="button"
          className="topbar-icon"
          title="Forward (Alt+Right)"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={forward}
        >
          <ArrowRight size={17} />
        </button>
      </div>

      <button type="button" className="search-trigger" onClick={() => onSearch()}>
        <Search size={15} />
        <span>Search or run a command</span>
        <kbd className="kbd">{shortcut}</kbd>
      </button>

      <div className="identity-chips" ref={containerRef}>
        {active.slice(0, fit).map(chip)}
        {hidden.length > 0 && (
          <ActionMenu
            label={`${hidden.length} more active identit${hidden.length === 1 ? 'y' : 'ies'}`}
            trigger={<span>+{hidden.length}</span>}
            triggerClassName="identity-chip identity-more"
            items={hidden.map((p) => ({
              label: `${p.name} · ${p.active}`,
              icon: <ProviderMark id={p.id} name={p.name} color={p.color} size={18} />,
              onSelect: () => open(p),
            }))}
          />
        )}
        <div className="identity-measure" ref={measureRef} aria-hidden>
          {active.map(chip)}
          <span className="identity-chip identity-more">+{active.length}</span>
        </div>
      </div>
    </header>
  );
}
