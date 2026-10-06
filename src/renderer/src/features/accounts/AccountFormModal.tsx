import { useEffect, useState } from 'react';
import { UserPlus, UserPen } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { useKeyNameCheck } from '../../hooks/useKeyNameCheck';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, RequiredMark, Segmented, Select } from '../../components/ui/Field';
import { Callout } from '../../components/ui/Feedback';
import { KeySelect } from '../../components/domain/KeySelect';
import { isValidEmail } from '../../../../shared/validation';
import type { AccountView, AddAccountResult, KeyType, ProviderOverview } from '../../../../shared/types';

const NAME_RE = /^[a-z0-9][a-z0-9._-]*$/i;

type Props =
  | { mode: 'create'; providers: ProviderOverview[]; initialProvider?: string; onClose: () => void; onCreated: (r: AddAccountResult) => void }
  | { mode: 'edit'; providers: ProviderOverview[]; account: AccountView; onClose: () => void };

export function AccountFormModal(props: Props) {
  const { providers, onClose } = props;
  const editing = props.mode === 'edit' ? props.account : null;
  const { run, isBusy } = useTask();

  const [provider, setProvider] = useState(editing?.provider ?? (props.mode === 'create' ? props.initialProvider : undefined) ?? providers[0]?.id ?? 'github');
  const [name, setName] = useState(editing?.name ?? '');
  const [keySource, setKeySource] = useState<'generate' | 'existing'>(editing ? 'existing' : 'generate');
  const [keyPath, setKeyPath] = useState(editing?.keyPath ?? '');
  const [keyType, setKeyType] = useState<KeyType>('ed25519');
  const [passphrase, setPassphrase] = useState('');
  const [gitName, setGitName] = useState(editing?.gitName ?? '');
  const [gitEmail, setGitEmail] = useState(editing?.gitEmail ?? '');
  // On by default: the commit identity is what makes switching accounts complete.
  const [setGitIdentity, setSetGitIdentity] = useState(editing?.setGitIdentity ?? true);
  const [touched, setTouched] = useState<{ gitName?: boolean; gitEmail?: boolean }>({});

  // Your name is usually the same on every account, so start from the global git config.
  useEffect(() => {
    if (editing) return;
    api.git.identity().then((id) => setGitName((current) => current || id.name), () => {});
  }, [editing]);
  const selected = providers.find((p) => p.id === provider);
  const [activate, setActivate] = useState(!selected?.active);

  const nameValid = NAME_RE.test(name);

  // A generated key is saved as ~/.ssh/id_<type>_<provider>_<name> unless that
  // file exists and the user picked an alternative name for this combination.
  const defaultFile = `id_${keyType}_${provider}_${name}`;
  const [fileOverride, setFileOverride] = useState<{ base: string; name: string } | null>(null);
  const keyFile = fileOverride?.base === defaultFile ? fileOverride.name : defaultFile;
  const generating = !editing && keySource === 'generate';
  const fileCheck = useKeyNameCheck(keyFile, generating && nameValid);
  const fileFree = !!fileCheck && fileCheck.valid && !fileCheck.exists;

  const gitNameValid = gitName.trim().length > 0;
  const gitEmailValid = isValidEmail(gitEmail);
  const canSubmit = nameValid && gitNameValid && gitEmailValid && (generating ? fileFree : !!keyPath);

  const submit = async () => {
    if (!canSubmit) return;
    if (props.mode === 'edit') {
      const ok = await run('save', () => api.accounts.update(props.account.provider, props.account.name, {
        name, keyPath, gitName, gitEmail, setGitIdentity,
      }), 'Account updated');
      if (ok) onClose();
      return;
    }
    const result = await run('save', () => api.accounts.add({
      provider,
      name,
      keyPath: keySource === 'existing' ? keyPath : undefined,
      generate: keySource === 'generate' ? { type: keyType, passphrase, comment: gitEmail || undefined, fileName: keyFile } : null,
      gitName,
      gitEmail,
      setGitIdentity,
      activate,
    }));
    if (result) props.onCreated(result);
  };

  return (
    <Modal
      title={editing ? `Edit ${editing.providerName} account` : 'Add git account'}
      icon={editing ? <UserPen size={18} /> : <UserPlus size={18} />}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!canSubmit} loading={isBusy('save')}>
            {editing ? 'Save' : keySource === 'generate' ? 'Generate key & add' : 'Add account'}
          </Button>
        </>
      )}
    >
      <div className="form-grid">
        <Field label="Provider" required>
          <Select
            value={provider}
            disabled={!!editing}
            onChange={(e) => {
              setProvider(e.target.value);
              setActivate(!providers.find((p) => p.id === e.target.value)?.active);
            }}
          >
            {providers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.hosts[0]})</option>)}
          </Select>
        </Field>
        <Field
          label="Account name"
          required
          hint={name && !nameValid ? 'Letters, digits, ".", "_" and "-" only' : `Alias host: ${selected?.hostname ?? selected?.hosts[0]}-${name || 'name'}`}
        >
          <Input value={name} placeholder="work, personal…" onChange={(e) => setName(e.target.value.trim())} />
        </Field>

        <div className="field full">
          <span className="field-label">SSH key<RequiredMark /></span>
          {!editing && (
            <Segmented
              value={keySource}
              onChange={setKeySource}
              options={[{ value: 'generate', label: 'Generate a new key' }, { value: 'existing', label: 'Use an existing key' }]}
            />
          )}
        </div>

        {keySource === 'generate' ? (
          <>
            <Field label="Key type" required>
              <Select value={keyType} onChange={(e) => setKeyType(e.target.value as KeyType)}>
                <option value="ed25519">Ed25519 (recommended)</option>
                <option value="rsa">RSA 4096</option>
                <option value="ecdsa">ECDSA P-521</option>
              </Select>
            </Field>
            <Field label="Passphrase" hint="Optional. Keys with a passphrase must be loaded into ssh-agent.">
              <Input type="password" value={passphrase} autoComplete="new-password" onChange={(e) => setPassphrase(e.target.value)} />
            </Field>
            {selected?.keyHint && <div className="full"><Callout tone="warning">{selected.keyHint}</Callout></div>}
            {nameValid && fileCheck?.exists && (
              <div className="full">
                <Callout tone="warning">
                  <div><code>~/.ssh/{keyFile}</code> already exists.</div>
                  <div className="row" style={{ marginTop: 6, gap: 14 }}>
                    <button type="button" className="link-button" onClick={() => { setKeySource('existing'); setKeyPath(`~/.ssh/${keyFile}`); }}>
                      Use the existing key
                    </button>
                    {fileCheck.suggestion && (
                      <button type="button" className="link-button" onClick={() => setFileOverride({ base: defaultFile, name: fileCheck.suggestion! })}>
                        Generate as {fileCheck.suggestion}
                      </button>
                    )}
                  </div>
                </Callout>
              </div>
            )}
            {nameValid && fileFree && <div className="full field-hint">Will be saved as <code>~/.ssh/{keyFile}</code></div>}
          </>
        ) : (
          <Field className="full" hint="Private key file; its .pub must be registered with the provider.">
            <KeySelect value={keyPath} onChange={setKeyPath} />
          </Field>
        )}

        <Field
          label="Git user.name"
          required
          hint="Shown as the author of commits made with this account"
          error={touched.gitName && !gitNameValid ? 'Enter the name to put on your commits' : undefined}
        >
          <Input
            value={gitName}
            placeholder="Jane Doe"
            onChange={(e) => setGitName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, gitName: true }))}
          />
        </Field>
        <Field
          label="Git user.email"
          required
          hint={`An email verified on this ${selected?.name ?? ''} account (or its no-reply address)${generating ? ' - also the key comment' : ''}`}
          error={touched.gitEmail && !gitEmailValid
            ? (gitEmail.trim() ? "That doesn't look like an email address" : 'Enter the email to put on your commits')
            : undefined}
        >
          <Input
            type="email"
            value={gitEmail}
            placeholder="jane@company.com"
            onChange={(e) => setGitEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, gitEmail: true }))}
          />
        </Field>

        <div className="full stack" style={{ gap: 10 }}>
          <Checkbox
            checked={setGitIdentity}
            onChange={setSetGitIdentity}
            label="Set the global git identity when this account becomes active"
            hint="Runs git config --global user.name / user.email on switch."
          />
          {!editing && (
            <Checkbox
              checked={activate}
              onChange={setActivate}
              label={`Make it the active ${selected?.name ?? ''} account`}
              hint={`Plain ${selected?.user ?? 'git'}@${selected?.hosts[0] ?? ''} URLs will authenticate with this key.`}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
