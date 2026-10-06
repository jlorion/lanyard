import { ROUTES, type PageId, type Route } from './routes';
import { useNavigation } from './navigation';
import { useWorkspace } from './workspace';
import { ThemeSwitcher } from './ThemeSwitcher';

const isMac = navigator.userAgent.includes('Mac');

export function Sidebar({ version }: { version: string }) {
  const { page, navigate } = useNavigation();
  const { providers, allHosts, keys } = useWorkspace();

  const counts: Partial<Record<PageId, number>> = {
    accounts: providers.reduce((n, p) => n + p.accounts.length, 0),
    hosts: allHosts.length, // same entries the Hosts page lists
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
        <button type="button" className="sidebar-version" title="About Lanyard" onClick={() => navigate('settings', 'about')}>
          v{version}
        </button>
      </div>
    </aside>
  );
}
