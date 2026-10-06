import { ExternalLink, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge, Callout } from '../../components/ui/Feedback';
import { ProviderMark } from '../../components/domain/ProviderMark';
import { AccountRow, type AccountRowActions } from './AccountRow';
import type { AccountView, ProviderOverview } from '../../../../shared/types';

export function ProviderCard({ provider, isBusy, onAdd, onOpenKeys, onDeactivate, actionsFor }: {
  provider: ProviderOverview;
  isBusy: (key: string) => boolean;
  onAdd: () => void;
  onOpenKeys: () => void;
  onDeactivate: () => void;
  actionsFor: (account: AccountView) => AccountRowActions;
}) {
  const p = provider;
  return (
    <section className="card provider-card">
      <header className="card-header">
        <ProviderMark name={p.name} color={p.color} />
        <div style={{ minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <h3 style={{ fontSize: 15 }}>{p.name}</h3>
            {p.custom && <Badge>custom</Badge>}
          </div>
          <div className="faint mono truncate">{p.hosts.join(' · ')}{p.port ? `:${p.port}` : ''}</div>
        </div>
        <span className="spacer" />
        {p.keysUrl && <Button size="sm" variant="ghost" iconOnly title={`Open ${p.name} SSH key settings`} icon={<ExternalLink size={14} />} onClick={onOpenKeys} />}
        <Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>Account</Button>
      </header>

      {p.conflicts.length > 0 && (
        <div className="card-body stack" style={{ paddingBottom: 0 }}>
          {p.conflicts.map((c) => <Callout key={c} tone="warning">{c}</Callout>)}
        </div>
      )}

      <div className="account-list">
        {p.accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            user={p.user}
            testing={isBusy(`test:${a.id}`)}
            switching={isBusy(`use:${p.id}`)}
            actions={actionsFor(a)}
          />
        ))}
      </div>

      <footer className="card-footer">
        {p.active ? (
          <>
            <span className="muted">
              <code>{p.user}@{p.hosts[0]}</code> → <b>{p.active}</b>
            </span>
            <span className="spacer" />
            <Button size="sm" variant="ghost" loading={isBusy(`use:${p.id}`)} onClick={onDeactivate}>Deactivate</Button>
          </>
        ) : (
          <span className="muted">No active account - plain <code>{p.hosts[0]}</code> URLs use your default SSH keys.</span>
        )}
      </footer>
    </section>
  );
}
