import { useState } from 'react';
import { Copy, FolderOpen, KeyRound, Lock, Plus, ShieldCheck, ShieldPlus, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { useToast } from '../../components/feedback/ToastProvider';
import { Button } from '../../components/ui/Button';
import { Badge, Callout, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { PublicKeyModal } from '../../components/domain/PublicKeyModal';
import { shortFingerprint, timeAgo } from '../../lib/format';
import { GenerateKeyModal } from './GenerateKeyModal';
import { PassphraseModal } from './PassphraseModal';
import { keyUsage } from './key-usage';
import { Skeleton } from '../../components/ui/Skeleton';
import { useIntent } from '../../app/navigation';
import type { KeyInfo } from '../../../../shared/types';

type Dialog = { kind: 'generate' } | { kind: 'passphrase'; key: KeyInfo } | { kind: 'public'; key: KeyInfo; publicKey: string };

export function KeysPage() {
  const keys = useResource(() => api.keys.list(), ['keys']);
  const accounts = useResource(() => api.accounts.overview(), ['state']);
  const hosts = useResource(() => api.hosts.list(), ['config']);
  const { run, isBusy } = useTask();
  const confirm = useConfirm();
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useIntent('generate-key', () => setDialog({ kind: 'generate' }));

  const list = keys.data ?? [];
  const usage = keyUsage(list, (accounts.data ?? []).flatMap((p) => p.accounts), hosts.data ?? []);

  const addToAgent = async (k: KeyInfo) => {
    try {
      await api.agent.add(k.tildePath);
      toast.success(`${k.name} added to ssh-agent`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'NEEDS_PASSPHRASE') {
        await run('term', () => api.app.addKeyInTerminal(k.tildePath), 'Enter the passphrase in the terminal window');
      } else {
        toast.error(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const remove = async (k: KeyInfo) => {
    const users = usage.get(k.name) ?? [];
    if (users.length) {
      toast.error(`${k.name} is still used by ${users.join(', ')}`);
      return;
    }
    const ok = await confirm({
      title: `Delete ${k.name}?`,
      message: <>The key pair is moved to <code>~/.lanyard/trash</code>, so it can still be recovered. Anything that relies on this key will stop working.</>,
      confirmLabel: 'Move to trash',
      danger: true,
    });
    if (ok) await run(`rm:${k.name}`, () => api.keys.remove(k.tildePath), `${k.name} moved to ~/.lanyard/trash`);
  };

  const showPublic = async (k: KeyInfo) => {
    const publicKey = await run(`pub:${k.name}`, () => api.keys.publicKey(k.tildePath));
    if (publicKey) setDialog({ kind: 'public', key: k, publicKey });
  };

  return (
    <>
      <PageHeader
        title="Keys"
        description="Key pairs in ~/.ssh. Fingerprints are computed locally; deleting moves keys to ~/.lanyard/trash."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: 'generate' })}>Generate key</Button>}
      />

      {keys.error && <Callout tone="danger">{keys.error}</Callout>}

      {keys.loading ? <Skeleton rows={4} /> : !list.length ? (
        <EmptyState
          icon={<KeyRound size={30} />}
          title="No SSH keys found"
          action={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: 'generate' })}>Generate key</Button>}
        >
          Generate an Ed25519 key to authenticate with servers and git providers.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Fingerprint</th>
                <th>Used by</th>
                <th className="actions" />
              </tr>
            </thead>
            <tbody>
              {list.map((k) => {
                const users = usage.get(k.name) ?? [];
                return (
                  <tr key={k.name}>
                    <td>
                      <div className="row" style={{ gap: 6 }}>
                        <span className="mono" style={{ fontWeight: 600 }}>{k.name}</span>
                        <Badge>{k.type}</Badge>
                        {k.encrypted && <Badge title="Protected with a passphrase"><Lock size={11} /></Badge>}
                        {!k.hasPrivate && <Badge tone="warning">public only</Badge>}
                      </div>
                      <div className="faint truncate" style={{ maxWidth: 320 }}>{k.comment || '(no comment)'} · {timeAgo(k.modifiedAt)}</div>
                    </td>
                    <td className="mono faint selectable" style={{ whiteSpace: 'nowrap' }} title={k.fingerprint}>{shortFingerprint(k.fingerprint)}</td>
                    <td>
                      {users.length
                        ? <div className="row" style={{ flexWrap: 'wrap', gap: 4 }}>{users.map((u) => <Badge key={u} tone="accent">{u}</Badge>)}</div>
                        : <span className="faint">-</span>}
                    </td>
                    <td className="actions">
                      <div className="row">
                        <Button size="sm" variant="ghost" icon={<Copy size={14} />} loading={isBusy(`pub:${k.name}`)} onClick={() => void showPublic(k)}>Public key</Button>
                        {k.hasPrivate && (
                          <>
                            <Button size="sm" variant="ghost" iconOnly title="Add to ssh-agent" icon={<ShieldPlus size={14} />} onClick={() => void addToAgent(k)} />
                            <Button size="sm" variant="ghost" iconOnly title={k.encrypted ? 'Change passphrase' : 'Set passphrase'} icon={<Lock size={14} />} onClick={() => setDialog({ kind: 'passphrase', key: k })} />
                            <Button size="sm" variant="ghost" iconOnly title="Restrict file permissions to you" icon={<ShieldCheck size={14} />} onClick={() => run(`perm:${k.name}`, () => api.keys.fixPermissions(k.tildePath), (r) => r.message)} />
                          </>
                        )}
                        <Button size="sm" variant="ghost" iconOnly title="Show in folder" icon={<FolderOpen size={14} />} onClick={() => run('reveal', () => api.app.revealPath(k.path ?? k.publicPath!))} />
                        <Button size="sm" variant="ghost" iconOnly danger title="Delete (move to trash)" icon={<Trash2 size={14} />} onClick={() => void remove(k)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {dialog?.kind === 'generate' && (
        <GenerateKeyModal
          onClose={() => setDialog(null)}
          onGenerated={(key, publicKey) => setDialog({ kind: 'public', key, publicKey })}
        />
      )}
      {dialog?.kind === 'passphrase' && <PassphraseModal keyInfo={dialog.key} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'public' && (
        <PublicKeyModal title={`${dialog.key.name}.pub`} publicKey={dialog.publicKey} onClose={() => setDialog(null)} />
      )}
    </>
  );
}
