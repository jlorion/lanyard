import { ROUTES, type PageId, type Route } from './routes';

export function Sidebar({ current, onNavigate, version }: {
  current: PageId;
  onNavigate: (page: PageId) => void;
  version: string;
}) {
  const sections = ROUTES.reduce<Record<string, Route[]>>((acc, r) => {
    (acc[r.section] ??= []).push(r);
    return acc;
  }, {});

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">&gt;_</div>
        <div>
          <div className="brand-name">Lanyard</div>
          <div className="brand-sub">keys · hosts · accounts</div>
        </div>
      </div>
      <nav>
        {Object.entries(sections).map(([section, routes]) => (
          <div key={section}>
            <div className="nav-section">{section}</div>
            {routes.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`nav-item${current === id ? ' active' : ''}`}
                aria-current={current === id ? 'page' : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div>v{version}</div>
        <div>Keeps running in the system tray</div>
      </div>
    </aside>
  );
}
