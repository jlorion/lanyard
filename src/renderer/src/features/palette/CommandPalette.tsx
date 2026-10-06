import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { useNavigation } from '../../app/navigation';
import { useWorkspace } from '../../app/workspace';
import { useAppearance } from '../../app/appearance';
import { buildCommands, filterCommands, type PaletteCommand } from './commands';

const MAX_RESULTS = 60;

export function CommandPalette({ initialQuery = '', onClose }: { initialQuery?: string; onClose: () => void }) {
  const { navigate } = useNavigation();
  const { providers, hosts, keys } = useWorkspace();
  const { setTheme, setAccent } = useAppearance();
  const { run } = useTask();
  const toast = useToast();
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo(
    () =>
      buildCommands({
        providers,
        hosts,
        keys,
        navigate,
        switchAccount: (p, name) => run('switch', () => api.accounts.use(p.id, name), `${p.name} now uses "${name}"`),
        connect: (alias) => run('connect', () => api.app.connect(alias)),
        setHostKey: (alias, k) => run('hostkey', () => api.hosts.setKey(alias, k.tildePath), `${alias} now uses ${k.name}`),
        testActive: async () => {
          const active = providers.filter((p) => p.active);
          if (!active.length) return toast.info('No active accounts to test');
          for (const p of active) {
            const r = await run(`test:${p.id}`, () => api.accounts.test(p.id));
            if (r) toast[r.ok ? 'success' : 'error'](`${r.account}: ${r.message}`);
          }
        },
        setTheme,
        setAccent,
      }),
    [providers, hosts, keys, navigate, run, toast, setTheme, setAccent],
  );

  const results = useMemo(() => filterCommands(commands, query).slice(0, MAX_RESULTS), [commands, query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const execute = (c: PaletteCommand | undefined) => {
    if (!c) return;
    onClose();
    void c.run();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(results[selected]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="palette-input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            spellCheck={false}
            placeholder="Switch an account, connect to a host, run an action…"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
          />
        </div>
        <div className="palette-list" id="palette-list" role="listbox" ref={listRef}>
          {!results.length && <div className="palette-empty">No matching commands</div>}
          {results.map((c, i) => {
            const header = c.group !== results[i - 1]?.group ? c.group : null;
            const Icon = c.icon;
            return (
              <div key={c.id}>
                {header && <div className="palette-group">{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={i === selected}
                  data-index={i}
                  className={`palette-item${i === selected ? ' selected' : ''}`}
                  onMouseMove={() => setSelected(i)}
                  onClick={() => execute(c)}
                >
                  <Icon size={16} />
                  <span className="palette-label">{c.label}</span>
                  {c.detail && <span className="palette-detail">{c.detail}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-footer">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navigate
          </span>
          <span>
            <kbd className="kbd">↵</kbd> run
          </span>
          <span>
            <kbd className="kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
}
