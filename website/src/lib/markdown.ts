// Markdown from the repository (docs/wiki, CHANGELOG.md) rendered for the site.
// Runs both in the prerender and in the browser, so both produce the same HTML.
// Links are rewritten so the same files work on GitHub, in the wiki and here.

import { Marked, type Tokens } from 'marked';
import GithubSlugger from 'github-slugger';
import changelogSource from '../../../CHANGELOG.md?raw';
import { GITHUB, withBase } from './site';

const files = import.meta.glob<string>('../../../docs/wiki/*.md', { query: '?raw', import: 'default', eager: true });
const WIKI: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([file, text]) => [file.replace(/^.*\/([^/]+)\.md$/, '$1'), text]),
);

/** URL of a wiki page on this site: Home -> /docs/, Getting-Started -> /docs/getting-started/. */
export function docPath(page: string): string {
  return page === 'Home' ? '/docs/' : `/docs/${page.toLowerCase()}/`;
}

function rewriteHref(href: string, from: 'wiki' | 'repo'): string {
  if (/^[a-z]+:|^#|^\/\//i.test(href)) return href; // absolute URL or in-page anchor
  if (href.startsWith('../images/')) return withBase(`/images/${href.slice('../images/'.length)}`);
  const page = href.match(/^([A-Za-z0-9_-]+)\.md(#.*)?$/);
  if (page && from === 'wiki') return withBase(docPath(page[1])) + (page[2] ?? '');
  // Any other relative link points into the repository on GitHub.
  const target = from === 'wiki' ? `docs/wiki/${href}` : href;
  return `${GITHUB}/blob/main/${target.replace(/\/[^/]+\/\.\.\//g, '/')}`;
}

export interface Heading {
  depth: number;
  text: string;
  id: string;
}

export interface Rendered {
  title: string;
  html: string;
  headings: Heading[];
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plain = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

export function renderMarkdown(source: string, from: 'wiki' | 'repo'): Rendered {
  const slugger = new GithubSlugger();
  const headings: Heading[] = [];
  let title = '';

  const marked = new Marked({
    gfm: true,
    walkTokens(token) {
      if (token.type === 'link' || token.type === 'image') token.href = rewriteHref(token.href, from);
    },
    renderer: {
      heading({ tokens, depth }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        const text = plain(inner);
        const id = slugger.slug(text);
        if (depth === 1 && !title) title = text;
        headings.push({ depth, text, id });
        if (depth === 1) return `<h1 id="${id}">${inner}</h1>\n`;
        return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>${inner}</h${depth}>\n`;
      },
      table(token: Tokens.Table) {
        const cell = (c: Tokens.TableCell, tag: 'th' | 'td') => `<${tag}>${this.parser.parseInline(c.tokens)}</${tag}>`;
        const head = `<tr>${token.header.map((c) => cell(c, 'th')).join('')}</tr>`;
        const rows = token.rows.map((r) => `<tr>${r.map((c) => cell(c, 'td')).join('')}</tr>`).join('');
        return `<div class="table-wrap"><table><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        const label = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
        return `<div class="code-block">${label}<button type="button" class="code-copy" data-copy-code aria-label="Copy code">Copy</button><pre><code>${escapeHtml(text)}</code></pre></div>\n`;
      },
      image({ href, text }: Tokens.Image) {
        return `<img src="${href}" alt="${escapeHtml(text)}" loading="lazy" width="1280" height="800">`;
      },
    },
  });

  const html = marked.parse(source, { async: false });
  return { title, html, headings };
}

// ---------------------------------------------------------------- wiki pages

export interface NavItem {
  title: string;
  page: string;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Every wiki page name (file name without .md), excluding _Sidebar and _Footer. */
export function wikiPages(): string[] {
  return Object.keys(WIKI).filter((p) => !p.startsWith('_'));
}

/** The wiki page served at /docs/<slug>/ ("" for the docs home). */
export function pageForSlug(slug: string | undefined): string | null {
  if (!slug) return 'Home';
  return wikiPages().find((p) => p.toLowerCase() === slug.toLowerCase() && p !== 'Home') ?? null;
}

const renderedPages = new Map<string, Rendered>();
export function wikiPage(page: string): Rendered {
  let r = renderedPages.get(page);
  if (!r) {
    r = renderMarkdown(WIKI[page], 'wiki');
    renderedPages.set(page, r);
  }
  return r;
}

/** The docs navigation, read from the wiki's own _Sidebar.md so the two never drift apart. */
export function wikiNav(): NavSection[] {
  const sections: NavSection[] = [{ title: '', items: [{ title: 'Overview', page: 'Home' }] }];
  for (const line of (WIKI._Sidebar ?? '').split(/\r?\n/)) {
    const heading = line.match(/^\*\*([^[*][^*]*)\*\*\s*$/);
    if (heading) {
      sections.push({ title: heading[1], items: [] });
      continue;
    }
    const item = line.match(/^- \[([^\]]+)\]\(([A-Za-z0-9_-]+)\.md\)/);
    if (item) sections[sections.length - 1].items.push({ title: item[1], page: item[2] });
  }
  return sections.filter((s) => s.items.length);
}

let changelogCache: Rendered | null = null;
export function changelog(): Rendered {
  changelogCache ??= renderMarkdown(changelogSource, 'repo');
  return changelogCache;
}
