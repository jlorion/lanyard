// Save the newest GitHub release (prereleases included) to src/generated so
// the pre-rendered pages carry real download links. The browser refreshes them
// later (src/lib/useRelease.ts), so a stale or failed fetch here is harmless.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(site, 'src', 'generated', 'release.json');
const { version } = JSON.parse(fs.readFileSync(path.join(site, '..', 'package.json'), 'utf8'));

let releases = [];
try {
  const headers = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch('https://api.github.com/repos/riomar0001/lanyard/releases?per_page=10', { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  releases = (await res.json())
    .filter((r) => !r.draft)
    .slice(0, 1)
    .map((r) => ({
      tag_name: r.tag_name,
      html_url: r.html_url,
      draft: false,
      prerelease: r.prerelease,
      assets: r.assets.map((a) => ({ name: a.name, browser_download_url: a.browser_download_url })),
    }));
} catch (err) {
  console.warn(`[release] ${err.message}; download buttons will link to the releases page until the browser refreshes them`);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ fallbackVersion: version, releases }, null, 2) + '\n');
console.log(`release: ${releases[0]?.tag_name ?? `none (fallback v${version})`}`);
