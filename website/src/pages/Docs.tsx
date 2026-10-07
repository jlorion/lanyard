import { useEffect, useState, type MouseEvent } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router';
import { Icon } from '../components/icons';
import { docPath, pageForSlug, wikiNav, wikiPage } from '../lib/markdown';
import { GITHUB, withBase } from '../lib/site';
import { NotFound } from './NotFound';

/**
 * Rendered markdown: follow internal links with the router instead of a full
 * page load, and wire up the code blocks' copy buttons.
 */
export function Prose({ html }: { html: string }) {
  const navigate = useNavigate();

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const copyButton = target.closest<HTMLButtonElement>('[data-copy-code]');
    if (copyButton) {
      const text = copyButton.parentElement?.querySelector('pre')?.textContent ?? '';
      void navigator.clipboard.writeText(text).then(() => {
        copyButton.textContent = 'Copied';
        window.setTimeout(() => (copyButton.textContent = 'Copy'), 1600);
      });
      return;
    }
    const a = target.closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target) return;
    const url = new URL(a.href, location.href);
    const base = withBase('/');
    if (url.origin === location.origin && url.pathname.startsWith(base) && url.pathname !== location.pathname) {
      e.preventDefault();
      navigate(`/${url.pathname.slice(base.length)}${url.hash}`);
    }
  };

  // Markdown from the repository, rendered at build time.
  return <div className="prose" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Docs() {
  const { slug } = useParams();
  const page = pageForSlug(slug);
  if (!page) return <NotFound />;
  return <DocPage page={page} />;
}

function DocPage({ page }: { page: string }) {
  const nav = wikiNav();
  const { html, headings } = wikiPage(page);
  const order = nav.flatMap((s) => s.items);
  const index = order.findIndex((i) => i.page === page);
  const prev = index > 0 ? order[index - 1] : null;
  const next = index >= 0 && index < order.length - 1 ? order[index + 1] : null;
  const toc = headings.filter((h) => h.depth === 2 || h.depth === 3);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [page]);

  return (
    <div className="container docs">
      <div className={`docs-nav${menuOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="docs-nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="docs-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="menu" size={16} /> Documentation menu
        </button>
        <nav aria-label="Documentation" id="docs-nav">
          {nav.map((section) => (
            <div key={section.title || 'top'} className="docs-nav-section">
              {section.title && <p>{section.title}</p>}
              <ul>
                {section.items.map((item) => (
                  <li key={item.page}>
                    <NavLink to={docPath(item.page)} end>
                      {item.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <article className="docs-main">
        <Prose html={html} />
        <div className="docs-footer">
          <a href={`${GITHUB}/edit/main/docs/wiki/${page}.md`}>
            <Icon name="edit" size={15} /> Edit this page on GitHub
          </a>
        </div>
        <nav className="docs-pager" aria-label="Previous and next page">
          {prev ? (
            <Link to={docPath(prev.page)} className="pager-link">
              <span>Previous</span>
              {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link to={docPath(next.page)} className="pager-link is-next">
              <span>Next</span>
              {next.title}
            </Link>
          )}
        </nav>
      </article>

      {toc.length > 1 && (
        <aside className="docs-toc" aria-label="On this page">
          <p>On this page</p>
          <ul>
            {toc.map((h) => (
              <li key={h.id} className={h.depth === 3 ? 'is-sub' : undefined}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
