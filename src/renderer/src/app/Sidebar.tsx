import { ROUTES, type PageId, type Route } from './routes';
import { useNavigation } from './navigation';
import { useWorkspace } from './workspace';
import { ThemeSwitcher } from './ThemeSwitcher';
import { LanyardMark } from '../components/brand/LanyardMark';

const isMac = navigator.userAgent.includes('Mac');

export function Sidebar({ version }: { version: string }) {
  const { page, navigate } = useNavigation();
  const { providers, hosts, keys } = useWorkspace();

  const counts: Partial<Record<PageId, number>> = {
    accounts: providers.reduce((n, p) => n + p.accounts.length, 0),
    hosts: hosts.length,
    keys: keys.length,
  };

  const sections = ROUTES.reduce<[string, Route[]][]>((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last[0] === r.section) last[1].push(r);
    else acc.push([r.section, [r]]);
    return acc;
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <LanyardMark size={34} />
        <div>
          <div className="brand-name">Lanyard</div>
          <div className="brand-sub">your SSH identities</div>
        </div>
      </div>

      <nav className="nav">
        {sections.map(([section, routes]) => (
          <div key={section || 'home'} className="nav-group">
            {section && <div className="nav-section">{section}</div>}
            {routes.map(({ id, label, icon: Icon }) => {
              const index = ROUTES.findIndex((r) => r.id === id) + 1;
              return (
                <button
                  key={id}
                  type="button"
                  className={`nav-item${page === id ? ' active' : ''}`}
                  aria-current={page === id ? 'page' : undefined}
                  title={`${label} (${isMac ? '⌘' : 'Ctrl+'}${index})`}
                  onClick={() => navigate(id)}
                >
                  <Icon size={17} />
                  <span>{label}</span>
                  {counts[id] ? <span className="nav-count">{counts[id]}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <ThemeSwitcher />
        <span className="sidebar-version">v{version}</span>
      </div>
    </aside>
  );
}
