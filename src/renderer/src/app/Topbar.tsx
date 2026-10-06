import { Search } from 'lucide-react';
import { useWorkspace } from './workspace';
import { useNavigation } from './navigation';
import { ProviderMark } from '../components/domain/ProviderMark';

const shortcut = navigator.userAgent.includes('Mac') ? '⌘K' : 'Ctrl K';

/** Search trigger plus "who am I" chips for every provider with an active account. */
export function Topbar({ onSearch }: { onSearch: (query?: string) => void }) {
  const { providers } = useWorkspace();
  const { navigate } = useNavigation();
  const active = providers.filter((p) => p.active);

  return (
    <header className="topbar">
      <button type="button" className="search-trigger" onClick={() => onSearch()}>
        <Search size={15} />
        <span>Search or run a command</span>
        <kbd className="kbd">{shortcut}</kbd>
      </button>
      <div className="identity-chips">
        {active.map((p) => (
          <button
            key={p.id}
            type="button"
            className="identity-chip"
            title={p.accounts.length > 1 ? `${p.name}: ${p.active} - click to switch` : `${p.name}: ${p.active}`}
            // With a single account there is nothing to switch to, so open the accounts page instead.
            onClick={() => (p.accounts.length > 1 ? onSearch(`${p.name}: use`) : navigate('accounts'))}
          >
            <ProviderMark id={p.id} name={p.name} color={p.color} size={20} />
            <span>{p.active}</span>
          </button>
        ))}
      </div>
    </header>
  );
}
