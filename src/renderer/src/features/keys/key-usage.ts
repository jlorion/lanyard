import type { AccountView, HostEntry, KeyInfo } from '../../../../shared/types';

function norm(p: string): string {
  return p.replace(/^"|"$/g, '').replace(/\\/g, '/').toLowerCase();
}

/** Which accounts and (user-defined) hosts reference each key, keyed by key name. */
export function keyUsage(keys: KeyInfo[], accounts: AccountView[], hosts: HostEntry[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  for (const key of keys) {
    const candidates = [key.tildePath, key.path ?? ''].filter(Boolean).map(norm);
    const users = [
      ...accounts.filter((a) => candidates.includes(norm(a.keyPath))).map((a) => a.id),
      ...hosts
        .filter((h) => !h.managed && h.options.some((o) => o.key.toLowerCase() === 'identityfile' && candidates.includes(norm(o.value))))
        .map((h) => `host ${h.alias}`),
    ];
    usage.set(key.name, users);
  }
  return usage;
}
