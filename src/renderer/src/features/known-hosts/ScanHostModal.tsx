import { useState } from 'react';
import { Radar } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { Badge, Callout } from '../../components/ui/Feedback';
import type { ScannedHostKey } from '../../../../shared/types';

/** ssh-keyscan a server, show fingerprints, then trust on confirmation. */
export function ScanHostModal({ onClose }: { onClose: () => void }) {
  const { run, isBusy } = useTask();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [keys, setKeys] = useState<ScannedHostKey[] | null>(null);

  const scan = async () => {
    setKeys(null);
    const r = await run('scan', () => api.knownHosts.scan(host.trim(), port || undefined));
    if (r) setKeys(r);
  };

  const trust = async () => {
    if (!keys) return;
    const r = await run('trust', () => api.knownHosts.trust(keys.map((k) => k.raw)), (res) =>
      res.added ? `${res.added} key(s) added to known_hosts` : 'Already trusted');
    if (r) onClose();
  };

  return (
    <Modal
      title="Scan host keys"
      icon={<Radar size={18} />}
      onClose={onClose}
      onSubmit={scan}
      wide
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          {keys
            ? <Button variant="primary" loading={isBusy('trust')} onClick={() => void trust()}>Trust these keys</Button>
            : <Button type="submit" variant="primary" disabled={!host.trim()} loading={isBusy('scan')}>Scan</Button>}
        </>
      )}
    >
      <div className="stack">
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 120px' }}>
          <Field label="Host">
            <Input mono value={host} placeholder="github.com" onChange={(e) => { setHost(e.target.value); setKeys(null); }} />
          </Field>
          <Field label="Port">
            <Input mono value={port} placeholder="22" inputMode="numeric" onChange={(e) => { setPort(e.target.value.replace(/\D/g, '')); setKeys(null); }} />
          </Field>
        </div>
        {keys && (
          <>
            <Callout tone="warning">Compare these fingerprints with the ones the provider or server admin publishes before trusting them.</Callout>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.raw}>
                      <td style={{ width: 110 }}><Badge>{k.type}</Badge></td>
                      <td className="mono selectable">{k.fingerprint}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
