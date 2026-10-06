import { useState } from 'react';
import { Eraser, Fingerprint, Radar, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Badge, Callout, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { ScanHostModal } from './ScanHostModal';
import type { KnownHostEntry } from '../../../../shared/types';

export function KnownHostsPage() {
  const { data = [], error, loading } = useResource(() => api.knownHosts.list(), ['knownHosts']);
  const { run, isBusy } = useTask();
  const confirm = useConfirm();
  const [query, setQuery] = useState('');
  const [forget, setForget] = useState('');
  const [scanning, setScanning] = useState(false);

  const q = query.toLowerCase();
  const rows = data.filter((e) => !q || e.hostsField.toLowerCase().includes(q) || e.fingerprint.toLowerCase().includes(q));
  const hashedCount = data.filter((e) => e.hashed).length;

  const removeEntry = async (e: KnownHostEntry) => {
    const label = e.hashed ? `the hashed entry on line ${e.line}` : e.hosts.join(', ');
    if (await confirm({ title: 'Remove host key?', message: <>Forget the {e.type} key for <b>{label}</b>? You will be asked to verify the host again on the next connection.</>, confirmLabel: 'Remove', danger: true })) {
      await run(`rm:${e.line}`, () => api.knownHosts.removeLine(e.line, e.fingerprint), 'Host key removed');
    }
  };

  const forgetHost = async () => {
    const [host, port] = forget.trim().split(':');
    const r = await run('forget', () => api.knownHosts.removeHost(host, port), (res) => (res.removed ? `Forgot ${host}` : `${host} was not in known_hosts`));
    if (r) setForget('');
  };

  return (
    <>
      <PageHeader
        title="Known hosts"
        description="Server keys you have trusted (~/.ssh/known_hosts). Remove an entry after a server is legitimately re-installed; scan a host to trust it up front."
        actions={<Button variant="primary" icon={<Radar size={15} />} onClick={() => setScanning(true)}>Scan host</Button>}
      />

      {error && <Callout tone="danger">{error}</Callout>}

      <div className="toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Search hosts or fingerprints…" />
        <span className="spacer" />
        <form className="row" onSubmit={(e) => { e.preventDefault(); void forgetHost(); }}>
          <Input mono value={forget} placeholder="host[:port]" style={{ width: 200 }} onChange={(e) => setForget(e.target.value)} />
          <Button type="submit" icon={<Eraser size={15} />} disabled={!forget.trim()} loading={isBusy('forget')} title="Removes all keys for the host, including hashed entries">Forget host</Button>
        </form>
      </div>

      {hashedCount > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Callout>{hashedCount} entr{hashedCount === 1 ? 'y is' : 'ies are'} hashed (HashKnownHosts), so host names can't be shown. Use "Forget host" to remove them by name.</Callout>
        </div>
      )}

      {!loading && !rows.length ? (
        <EmptyState icon={<Fingerprint size={30} />} title={data.length ? 'No matching entries' : 'known_hosts is empty'} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th style={{ width: 60 }}>Line</th><th>Hosts</th><th>Type</th><th>Fingerprint</th><th className="actions" /></tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.line}>
                  <td className="faint mono">{e.line}</td>
                  <td className="mono selectable">
                    {e.hashed ? <span className="faint">(hashed)</span> : e.hosts.join(', ')}
                    {e.marker && <> <Badge tone="warning">{e.marker}</Badge></>}
                  </td>
                  <td><Badge>{e.type}</Badge></td>
                  <td className="mono faint selectable">{e.fingerprint}</td>
                  <td className="actions">
                    <Button size="sm" variant="ghost" iconOnly danger title="Remove entry" icon={<Trash2 size={14} />} onClick={() => void removeEntry(e)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {scanning && <ScanHostModal onClose={() => setScanning(false)} />}
    </>
  );
}
