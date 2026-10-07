// Copy the screenshots and the logo from the repository into public/, so the
// site and the user guide share one set of images.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(site, '..');
const pub = path.join(site, 'public');

fs.rmSync(path.join(pub, 'images'), { recursive: true, force: true });
fs.cpSync(path.join(repo, 'docs', 'images'), path.join(pub, 'images'), { recursive: true });
fs.copyFileSync(path.join(repo, 'resources', 'icon.png'), path.join(pub, 'icon.png'));
console.log(`synced ${fs.readdirSync(path.join(pub, 'images')).length} images and the logo`);
