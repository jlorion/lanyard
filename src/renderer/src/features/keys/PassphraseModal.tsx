import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import type { KeyInfo } from '../../../../shared/types';

export function PassphraseModal({ keyInfo, onClose }: { keyInfo: KeyInfo; onClose: () => void }) {
  const { run, isBusy } = useTask();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const mismatch = next !== confirmation;

  const submit = async () => {
    if (mismatch) return;
    const ok = await run('save', () => api.keys.changePassphrase(keyInfo.tildePath, current, next),
      next ? 'Passphrase changed' : 'Passphrase removed');
    if (ok) onClose();
  };

  return (
    <Modal
      title={`Passphrase for ${keyInfo.name}`}
      icon={<Lock size={18} />}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={mismatch} loading={isBusy('save')}>Save</Button>
        </>
      )}
    >
      <div className="stack">
        {keyInfo.encrypted && (
          <Field label="Current passphrase">
            <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
        )}
        <Field label="New passphrase" hint="Leave empty to remove the passphrase">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new passphrase" hint={mismatch ? 'Passphrases do not match' : undefined}>
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
