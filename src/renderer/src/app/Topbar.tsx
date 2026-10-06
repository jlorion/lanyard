import { useLayoutEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useWorkspace } from './workspace';
import { useNavigation } from './navigation';
import { ProviderMark } from '../components/domain/ProviderMark';
import { ActionMenu } from '../components/ui/ActionMenu';
import type { ProviderOverview } from '../../../shared/types';

const shortcut = navigator.userAgent.includes('Mac') ? '⌘K' : 'Ctrl K';
const CHIP_GAP = 6; // keep in sync with .identity-chips gap

/** Search trigger plus "who am I" chips for every provider with an active account. */
export function Topbar({ onSearch }: { onSearch: (query?: string) => void }) {
  const { providers } = useWorkspace();
  const { navigate } = useNavigation();
  const active = providers.filter((p) => p.active);

  // With a single account there is nothing to switch to, so open the accounts page instead.
  const open = (p: ProviderOverview) => (p.accounts.length > 1 ? onSearch(`${p.name}: use`) : navigate('accounts'));

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
      const available = container.clientWidth;
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
