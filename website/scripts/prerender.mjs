// Render every route to static HTML (dist/<route>/index.html) with the SSR
// bundle, so pages work without JavaScript, load fast and can be indexed.
// React then hydrates them in the browser.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(site, 'dist');
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const { render, routes } = await import(pathToFileURL(path.join(site, 'dist-ssr', 'entry-server.js')).href);

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

for (const route of [...routes(), '/404/']) {
  const { html, head } = render(route);
  const meta = [
    `<title>${escape(head.title)}</title>`,
    `<meta name="description" content="${escape(head.description)}" />`,
    `<meta property="og:title" content="${escape(head.title)}" />`,
    `<meta property="og:description" content="${escape(head.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:image" content="${escape(head.image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    head.canonical ? `<link rel="canonical" href="${escape(head.canonical)}" />` : '',
  ].join('\n    ');
  const page = template.replace('<!--app-head-->', meta).replace('<!--app-html-->', html);
  // GitHub Pages serves 404.html for unknown paths.
  const file = route === '/404/' ? path.join(dist, '404.html') : path.join(dist, route, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, page);
}
fs.rmSync(path.join(site, 'dist-ssr'), { recursive: true, force: true });
console.log(`prerendered ${routes().length} pages + 404.html`);
