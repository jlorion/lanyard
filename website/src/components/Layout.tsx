import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { GITHUB, RELEASES, withBase } from '../lib/site';
import { ThemeToggle } from './controls';
import { Icon } from './icons';

const NAV = [
  { to: '/#features', label: 'Features' },
  { to: '/#cli', label: 'CLI' },
  { to: '/docs/', label: 'Docs', page: true },
  { to: '/changelog/', label: 'Changelog', page: true },
];

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.hash]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="container header-row">
        <Link to="/" className="brand" aria-label="Lanyard home">
          <img src={withBase('/icon.png')} alt="" width={28} height={28} />
          <span>Lanyard</span>
        </Link>
        <nav aria-label="Main" className="main-nav">
          {NAV.map((l) =>
            l.page ? (
              <NavLink key={l.to} to={l.to}>
                {l.label}
              </NavLink>
            ) : (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ),
          )}
          <a href={GITHUB}>GitHub</a>
        </nav>
        <div className="header-actions">
          <ThemeToggle />
          <Link to="/download/" className="btn btn-primary btn-sm">
            Download
          </Link>
        </div>
        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label="Menu"
          onClick={() => setOpen(!open)}
        >
          <Icon name="menu" className="icon-open" />
          <Icon name="close" className="icon-close" />
        </button>
      </div>
      <div id="mobile-menu" className={`mobile-menu${open ? ' is-open' : ''}`}>
        {NAV.map((l) => (
          <Link key={l.to} to={l.to}>
            {l.label}
          </Link>
        ))}
        <a href={GITHUB}>GitHub</a>
        <div className="mobile-theme">
          <span>Theme</span>
          <ThemeToggle large />
        </div>
        <Link to="/download/" className="btn btn-primary">
          Download
        </Link>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <div className="footer-brand">
          <div>
            <img src={withBase('/icon.png')} alt="" width={24} height={24} />
            Lanyard
          </div>
          <p>Wear the right identity everywhere. Free and open source under the MIT license.</p>
        </div>
        <nav aria-label="Footer" className="footer-nav">
          <Link to="/docs/">User guide</Link>
          <Link to="/download/">Download</Link>
          <Link to="/changelog/">Changelog</Link>
          <a href={GITHUB}>GitHub</a>
          <a href={RELEASES}>Releases</a>
          <a href={`${GITHUB}/security/policy`}>Security policy</a>
          <a href={`${GITHUB}/blob/main/SECURITY.md#code-signing-policy`}>Code signing policy</a>
          <a href={`${GITHUB}/blob/main/LICENSE`}>MIT license</a>
        </nav>
      </div>
      <div className="wordmark" aria-hidden="true">
        Lanyard
      </div>
    </footer>
  );
}

/** Scroll to the hash target (or the top) after each navigation. */
function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <ScrollManager />
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
