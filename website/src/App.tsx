import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router';
import { Layout } from './components/Layout';
import { docPath, pageForSlug, wikiPage, wikiPages } from './lib/markdown';
import { withBase } from './lib/site';
import { Changelog } from './pages/Changelog';
import { Docs } from './pages/Docs';
import { DownloadPage } from './pages/Download';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';

const SITE_URL = 'https://riomar0001.github.io';
const DESCRIPTION =
  'Switch between GitHub, GitLab, Bitbucket and Hugging Face accounts in one click, and manage your remote SSH servers, keys, ssh-agent and known_hosts. Desktop app, tray and CLI.';

export interface Head {
  title: string;
  description: string;
  image: string;
  canonical: string | null;
}

/** Every route that is pre-rendered to a static page. */
export function routes(): string[] {
  return ['/', '/download/', '/changelog/', ...wikiPages().map(docPath)];
}

/** <title> and meta tags for a route (used by the prerender and on navigation). */
export function headFor(pathname: string): Head {
  const image = SITE_URL + withBase('/images/overview.png');
  const canonical = SITE_URL + withBase(pathname);
  const base = { description: DESCRIPTION, image, canonical };
  if (pathname === '/') return { ...base, title: 'Lanyard: wear the right identity everywhere' };
  if (pathname === '/download/')
    return {
      ...base,
      title: 'Download Lanyard for Windows, macOS and Linux',
      description: 'Direct downloads of the newest Lanyard release.',
    };
  if (pathname === '/changelog/') return { ...base, title: 'Changelog · Lanyard', description: 'What changed in each Lanyard release.' };
  const doc = pathname.match(/^\/docs\/(?:([^/]+)\/)?$/);
  const page = doc && pageForSlug(doc[1]);
  if (page) {
    const title = wikiPage(page).title;
    return {
      ...base,
      title: page === 'Home' ? 'Lanyard documentation' : `${title} · Lanyard docs`,
      description: `${title}: the Lanyard user guide.`,
    };
  }
  return { ...base, title: 'Page not found · Lanyard', canonical: null };
}

function TitleSync() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = headFor(pathname).title;
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <Layout>
      <TitleSync />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/download/" element={<DownloadPage />} />
        <Route path="/changelog/" element={<Changelog />} />
        <Route path="/docs/" element={<Docs />} />
        <Route path="/docs/:slug/" element={<Docs />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
