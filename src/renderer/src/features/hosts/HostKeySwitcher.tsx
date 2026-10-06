import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import type { HostEntry, KeyInfo } from '../../../../shared/types';

function norm(p: string): string {
  return p.replace(/^"|"$/g, '').replace(/\\/g, '/').replace(/^~\//, '').toLowerCase();
}

/** Matches an IdentityFile value against a key, tolerating "~", quotes and slash style. */
function matches(key: KeyInfo, identityFile: string): boolean {
  if (!identityFile) return false;
  const target = norm(identityFile);
  return [key.tildePath, key.path ?? ''].some((p) => p && (norm(p) === target || norm(p).endsWith(`/${target}`)));
}

const DEFAULT = '__default__';

/** Inline dropdown that switches the key a host authenticates with. */
export function HostKeySwitcher({ host, keys }: { host: HostEntry; keys: KeyInfo[] }) {
  const { run, isBusy } = useTask();
  const current = keys.find((k) => matches(k, host.identityFile));
  const value = current ? current.tildePath : host.identityFile || DEFAULT;

  const change = (next: string) =>
    run('key', () => api.hosts.setKey(host.alias, next === DEFAULT ? null : next), (h) =>
      `${host.alias} now uses ${h.identityFile ? next.split('/').pop() : 'the default SSH keys'}`);

  return (
    <select
      className="select key-switcher"
      value={value}
      disabled={isBusy('key')}
      title="SSH key used for this host"
      onChange={(e) => void change(e.target.value)}
    >
      <option value={DEFAULT}>Default SSH keys</option>
      {host.identityFile && !current && <option value={host.identityFile}>{host.identityFile} (missing)</option>}
      {keys.map((k) => (
        <option key={k.tildePath} value={k.tildePath}>{k.name}{k.encrypted ? ' 🔒' : ''}</option>
      ))}
    </select>
  );
}
