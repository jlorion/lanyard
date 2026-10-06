import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';

/** Add a self-hosted provider (GitLab, Gitea, Forgejo, Bitbucket Server, ...). */
export function ProviderFormModal({ onClose }: { onClose: () => void }) {
  const { run, isBusy } = useTask();
  const [hostname, setHostname] = useState('');
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [port, setPort] = useState('');
  const [user, setUser] = useState('git');
  const [keysUrl, setKeysUrl] = useState('');

  const suggestedId = hostname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const finalId = id || suggestedId;

  const submit = async () => {
    const ok = await run('save', () => api.accounts.addProvider({ id: finalId, name: name || hostname, hostname, port, user, keysUrl }), 'Provider added');
    if (ok) onClose();
  };

  return (
    <Modal
      title="Add custom provider"
      icon={<Building2 size={18} />}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!hostname || !finalId} loading={isBusy('save')}>Add provider</Button>
        </>
      )}
    >
      <div className="form-grid">
        <Field label="SSH hostname" className="full" hint="For example git.company.com">
          <Input mono value={hostname} onChange={(e) => setHostname(e.target.value.trim())} />
        </Field>
        <Field label="Display name">
          <Input value={name} placeholder={hostname || 'Company GitLab'} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Id" hint="Used in CLI commands">
          <Input mono value={id} placeholder={suggestedId || 'company-gitlab'} onChange={(e) => setId(e.target.value.trim())} />
        </Field>
        <Field label="SSH user">
          <Input mono value={user} onChange={(e) => setUser(e.target.value.trim())} />
        </Field>
        <Field label="Port" hint="Leave empty for 22">
          <Input mono value={port} inputMode="numeric" onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="SSH keys page (optional)" className="full">
          <Input mono value={keysUrl} placeholder="https://git.company.com/-/user_settings/ssh_keys" onChange={(e) => setKeysUrl(e.target.value.trim())} />
        </Field>
      </div>
    </Modal>
  );
}
