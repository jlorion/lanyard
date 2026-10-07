// Used only by scripts/prerender.mjs to render each route to static HTML.
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App, headFor, routes } from './App';

export { routes };

export function render(pathname: string) {
  const html = renderToString(
    <StrictMode>
      <StaticRouter basename={import.meta.env.BASE_URL} location={import.meta.env.BASE_URL.replace(/\/$/, '') + pathname}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
  return { html, head: headFor(pathname) };
}
