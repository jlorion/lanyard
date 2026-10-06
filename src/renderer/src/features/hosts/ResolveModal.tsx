import { useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Callout } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';

const INTERESTING = [
  'hostname',
  'user',
  'port',
  'identityfile',
  'identitiesonly',
  'proxyjump',
  'proxycommand',
  'forwardagent',
  'userknownhostsfile',
];

/** Shows what `ssh -G <alias>` resolves to after every matching block applies. */
export function ResolveModal({ alias, onClose }: { alias: string; onClose: () => void }) {
  const { data = [], error, loading } = useResource(() => api.hosts.resolve(alias));
  const [query, setQuery] = useState('');
  const q = query.toLowerCase();
  const rows = data
    .filter((o) => !q || o.key.includes(q) || o.value.toLowerCase().includes(q))
    .sort((a, b) => Number(INTERESTING.includes(b.key)) - Number(INTERESTING.includes(a.key)));

  return (
    <Modal
      title={`Effective config for ${alias}`}
      icon={<Eye size={18} />}
      onClose={onClose}
      wide
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="stack">
        <p className="muted">
          Output of <code>ssh -G {alias}</code>: the final value of every option once all matching Host/Match blocks are applied. Key
          settings are listed first.
        </p>
        <SearchInput value={query} onChange={setQuery} placeholder="Filter options…" />
        {error && <Callout tone="danger">{error}</Callout>}
        {!loading && (
          <div className="table-wrap" style={{ maxHeight: 380, overflowY: 'auto' }}>
            <table className="table">
              <tbody>
                {rows.map((o, i) => (
                  <tr key={`${o.key}-${i}`}>
                    <td className="mono" style={{ width: 220, color: INTERESTING.includes(o.key) ? 'var(--accent)' : undefined }}>
                      {o.key}
                    </td>
                    <td className="mono selectable">{o.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
