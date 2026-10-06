import { useState } from 'react';
import { Activity, Building2, ChevronsDownUp, ChevronsUpDown, GitBranch, Plus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Callout, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { ProviderMark } from '../../components/domain/ProviderMark';
import { Skeleton } from '../../components/ui/Skeleton';
import { useIntent } from '../../app/navigation';
import { usePersistentState } from '../../hooks/usePersistentState';
import { ProviderCard } from './ProviderCard';
import { AccountFormModal } from './AccountFormModal';
import { AddAccountFlow } from './AddAccountFlow';
import { ProviderFormModal } from './ProviderFormModal';
import { RepoModal } from './RepoModal';
import type { AccountView, ProviderOverview } from '../../../../shared/types';

type Dialog =
  | { kind: 'add'; provider?: string }
  | { kind: 'edit'; account: AccountView }
  | { kind: 'repo'; account: AccountView }
  | { kind: 'provider' };

export function AccountsPage() {
  const { data: providers = [], error, loading } = useResource(() => api.accounts.overview(), ['state', 'config', 'keys']);
  const { run, isBusy } = useTask();
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // Cards start collapsed; only providers the user opened are remembered as expanded.
  const [expanded, setExpanded] = usePersistentState<Record<string, boolean>>('lanyard.accounts.expanded', {});
  const isCollapsed = (id: string) => !expanded[id];
  const setProviderCollapsed = (id: string, value: boolean) => setExpanded((e) => ({ ...e, [id]: !value }));
  useIntent('add-account', () => setDialog({ kind: 'add' }));

  const withAccounts = providers.filter((p) => p.accounts.length);
  const allCollapsed = withAccounts.length > 0 && withAccounts.every((p) => isCollapsed(p.id));
  const setAllCollapsed = (value: boolean) =>
    setExpanded(Object.fromEntries(withAccounts.map((p) => [p.id, !value])));
  const available = providers.filter((p) => !p.accounts.length);

  const test = async (a: AccountView) => {
    const r = await run(`test:${a.id}`, () => api.accounts.test(a.provider, a.name));
    if (!r) return;
    if (r.ok) toast.success(`${a.id}: ${r.message}`);
    else toast.error(`${a.id}: ${r.message}${r.hint ? `\n${r.hint}` : ''}`);
  };

  const testActive = async () => {
    for (const p of withAccounts.filter((x) => x.active)) {
      const a = p.accounts.find((x) => x.active);
      if (a) void test(a);
    }
  };

  const use = (p: ProviderOverview, name: string | null) =>
    run(`use:${p.id}`, () => api.accounts.use(p.id, name), (r) =>
      r.active ? `${p.name} now uses "${r.active}"${r.gitIdentityApplied ? ' · git identity updated' : ''}` : `${p.name}: no active account`);

  const remove = async (a: AccountView) => {
    const ok = await confirm({
      title: `Remove ${a.id}?`,
      message: <>The account and its <code>{a.alias}</code> host entry are removed from your SSH config. The key file <code>{a.keyPath}</code> is kept.</>,
      confirmLabel: 'Remove account',
      danger: true,
    });
    if (ok) await run(`rm:${a.id}`, () => api.accounts.remove(a.provider, a.name), `Removed ${a.id}`);
  };

  const removeProvider = async (p: ProviderOverview) => {
    if (await confirm({ title: `Remove provider ${p.name}?`, message: 'Only the provider definition is removed.', confirmLabel: 'Remove', danger: true })) {
      await run(`rmp:${p.id}`, () => api.accounts.removeProvider(p.id), `Removed ${p.name}`);
    }
  };

  const actionsFor = (p: ProviderOverview) => (a: AccountView) => ({
    onUse: () => void use(p, a.name),
    onTest: () => void test(a),
    onCopyKey: () => void run(`copy:${a.id}`, async () => api.app.copy(await api.keys.publicKey(a.keyPath)), 'Public key copied'),
    onRepo: () => setDialog({ kind: 'repo', account: a }),
    onEdit: () => setDialog({ kind: 'edit', account: a }),
    onRemove: () => void remove(a),
  });

  return (
    <>
      <PageHeader
        title="Git accounts"
        description={<>Switch which key <code>git@github.com</code>, <code>hf.co</code>, <code>gitlab.com</code>… use. Every account also gets its own alias host, so several accounts can be used side by side.</>}
        actions={(
          <>
            {withAccounts.length > 1 && (
              <Button
                variant="ghost"
                icon={allCollapsed ? <ChevronsUpDown size={15} /> : <ChevronsDownUp size={15} />}
                onClick={() => setAllCollapsed(!allCollapsed)}
              >
                {allCollapsed ? 'Expand all' : 'Collapse all'}
              </Button>
            )}
            {withAccounts.some((p) => p.active) && <Button icon={<Activity size={15} />} onClick={testActive}>Test active</Button>}
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: 'add' })}>Add account</Button>
          </>
        )}
      />

      {error && <Callout tone="danger">{error}</Callout>}
      {loading && <Skeleton rows={2} height={180} />}

      {!loading && !withAccounts.length && (
        <EmptyState
          icon={<GitBranch size={30} />}
          title="No git accounts yet"
          action={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setDialog({ kind: 'add' })}>Add your first account</Button>}
        >
          Add an account per identity - for example a work and a personal GitHub account - and switch between them from here or from the tray icon.
        </EmptyState>
      )}

      <div className="grid-cards">
        {withAccounts.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            collapsed={isCollapsed(p.id)}
            onToggle={() => setProviderCollapsed(p.id, !isCollapsed(p.id))}
            isBusy={isBusy}
            onAdd={() => setDialog({ kind: 'add', provider: p.id })}
            onOpenKeys={() => void run('open', () => api.app.openExternal(p.keysUrl))}
            onDeactivate={() => void use(p, null)}
            actionsFor={actionsFor(p)}
          />
        ))}
      </div>

      {!loading && (
        <>
          <div className="section-title">{withAccounts.length ? 'More providers' : 'Supported providers'}</div>
          <div className="provider-chips">
            {available.map((p) => (
              <div key={p.id} className="provider-chip">
                <button type="button" onClick={() => setDialog({ kind: 'add', provider: p.id })}>
                  <ProviderMark id={p.id} name={p.name} color={p.color} size={24} />
                  <span>{p.name}</span>
                  <Plus size={14} className="faint" />
                </button>
                {p.custom && (
                  <Button size="sm" variant="ghost" iconOnly danger title="Remove provider" icon={<X size={13} />} onClick={() => void removeProvider(p)} />
                )}
              </div>
            ))}
            <div className="provider-chip">
              <button type="button" onClick={() => setDialog({ kind: 'provider' })}>
                <Building2 size={18} className="faint" />
                <span>Self-hosted…</span>
              </button>
            </div>
          </div>
        </>
      )}

      {dialog?.kind === 'add' && (
        <AddAccountFlow
          providers={providers}
          initialProvider={dialog.provider}
          onClose={() => setDialog(null)}
          onCreated={(result) => setProviderCollapsed(result.account.provider, false)}
        />
      )}
      {dialog?.kind === 'edit' && (
        <AccountFormModal mode="edit" providers={providers} account={dialog.account} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'repo' && <RepoModal account={dialog.account} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'provider' && <ProviderFormModal onClose={() => setDialog(null)} />}
    </>
  );
}
