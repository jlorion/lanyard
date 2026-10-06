/**
 * Watches ~/.ssh and ~/.sshm so changes made by the CLI, an editor or another
 * tool show up in the window and tray without a manual refresh.
 */

import fs from 'node:fs';
import { paths } from '../core';
import type { ChangeTopic } from '../shared/ipc';

const DEBOUNCE_MS = 250;

function topicFor(dir: 'ssh' | 'data', file: string | null): ChangeTopic | null {
  if (dir === 'data') return file === 'state.json' ? 'state' : null;
  if (!file) return 'keys';
  if (file === 'config') return 'config';
  if (file.startsWith('known_hosts')) return 'knownHosts';
  return 'keys';
}

export function watchFiles(onChange: (topics: ChangeTopic[]) => void): () => void {
  const pending = new Set<ChangeTopic>();
  let timer: NodeJS.Timeout | null = null;
  const flush = () => {
    timer = null;
    const topics = [...pending];
    pending.clear();
    onChange(topics);
  };

  const watchers: fs.FSWatcher[] = [];
  const watchDir = (dir: string, kind: 'ssh' | 'data') => {
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const w = fs.watch(dir, (_event, filename) => {
        const topic = topicFor(kind, filename ? filename.toString() : null);
        if (!topic) return;
        pending.add(topic);
        if (!timer) timer = setTimeout(flush, DEBOUNCE_MS);
      });
      w.on('error', (err) => console.error(`watcher error for ${dir}:`, err));
      watchers.push(w);
    } catch (err) {
      console.error(`could not watch ${dir}:`, err);
    }
  };

  watchDir(paths.sshDir, 'ssh');
  watchDir(paths.dataDir, 'data');

  return () => {
    if (timer) clearTimeout(timer);
    watchers.forEach((w) => w.close());
  };
}
