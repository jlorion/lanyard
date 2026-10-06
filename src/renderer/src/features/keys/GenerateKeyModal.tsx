import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { useKeyNameCheck } from '../../hooks/useKeyNameCheck';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import type { KeyInfo, KeyType } from '../../../../shared/types';

export function GenerateKeyModal({ onClose, onGenerated }: {
  onClose: () => void;
  onGenerated: (key: KeyInfo, publicKey: string) => void;
}) {
  const { run, isBusy } = useTask();
  const [type, setType] = useState<KeyType>('ed25519');
  const [name, setName] = useState('id_ed25519');
  const [nameTouched, setNameTouched] = useState(false);
  const [comment, setComment] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const mismatch = passphrase !== confirmation;
  const check = useKeyNameCheck(name);
  const nameOk = !!check && check.valid && !check.exists;
  const valid = nameOk && !mismatch;

  const nameError = check && !nameOk ? (
    <>
      <span>{check.message}</span>
      {check.suggestion && (
        <button type="button" className="link-button" onClick={() => { setNameTouched(true); setName(check.suggestion!); }}>
          Use {check.suggestion}
        </button>
      )}
    </>
  ) : undefined;

  const changeType = (t: KeyType) => {
    setType(t);
    if (!nameTouched) setName(`id_${t}`);
  };

  const submit = async () => {
    if (!valid) return;
    const result = await run('gen', async () => {
      const key = await api.keys.generate({ name, type, comment, passphrase });
      return { key, pub: await api.keys.publicKey(key.tildePath) };
    });
    if (result) onGenerated(result.key, result.pub);
  };

  return (
    <Modal
      title="Generate SSH key"
      icon={<KeyRound size={18} />}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!valid} loading={isBusy('gen')}>Generate</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Field label="Type" required>
          <Select value={type} onChange={(e) => changeType(e.target.value as KeyType)}>
            <option value="ed25519">Ed25519 (recommended)</option>
            <option value="rsa">RSA 4096</option>
            <option value="ecdsa">ECDSA P-521</option>
          </Select>
        </Field>
        <Field label="File name" required hint={`Saved in ~/.ssh/${name || '…'}`} error={nameError}>
          <Input mono value={name} onChange={(e) => { setNameTouched(true); setName(e.target.value.trim()); }} />
        </Field>
        <Field label="Comment" className="full" hint="Usually your email; shown next to the key on servers and git hosts">
          <Input value={comment} placeholder="you@example.com" onChange={(e) => setComment(e.target.value)} />
        </Field>
        <Field label="Passphrase" hint="Optional but recommended">
          <Input type="password" autoComplete="new-password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
        </Field>
        <Field label="Confirm passphrase" error={mismatch && confirmation ? 'Passphrases do not match' : undefined}>
          <Input type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
