import { ChevronDown, ExternalLink, Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge, Callout } from '../../components/ui/Feedback';
import { ProviderMark } from '../../components/domain/ProviderMark';
import { AccountRow, type AccountRowActions } from './AccountRow';
import type { AccountView, ProviderOverview } from '../../../../shared/types';

export function ProviderCard({
  provider,
  collapsed,
  onToggle,
  isBusy,
  onAdd,
  onOpenKeys,
  onDeactivate,
  actionsFor,
}: {
  provider: ProviderOverview;
  collapsed: boolean;
  onToggle: () => void;
  isBusy: (key: string) => boolean;
  onAdd: () => void;
  onOpenKeys: () => void;
  onDeactivate: () => void;
  actionsFor: (account: AccountView) => AccountRowActions;
}) {
  const p = provider;
  const bodyId = `provider-body-${p.id}`;
  const count = `${p.accounts.length} account${p.accounts.length === 1 ? '' : 's'}`;

  return (
    <section className={`card provider-card${collapsed ? ' collapsed' : ''}`}>
      <header className="card-header">
        <button
          type="button"
          className="provider-toggle"
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          title={collapsed ? 'Expand' : 'Collapse'}
          onClick={onToggle}
        >
          <ChevronDown size={16} className="provider-chevron" />
          <ProviderMark id={p.id} name={p.name} color={p.color} />
          <span className="provider-title">
            <span className="row" style={{ gap: 8 }}>
              <span className="provider-name">{p.name}</span>
              {p.custom && <Badge>custom</Badge>}
            </span>
            <span className="provider-sub truncate">
              {collapsed ? (
                <>
                  {p.active ? (
                    <>
                      using <b>{p.active}</b>
                    </>
                  ) : (
                    'no active account'
                  )}{' '}
                  · {count}
                </>
              ) : (
                <span className="mono">
                  {p.hosts.join(' · ')}
                  {p.port ? `:${p.port}` : ''}
                </span>
              )}
            </span>
          </span>
        </button>
        {p.keysUrl && (
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            title={`Open ${p.name} SSH key settings`}
            icon={<ExternalLink size={14} />}
            onClick={onOpenKeys}
          />
        )}
        <Button size="sm" icon={<Plus size={14} />} onClick={onAdd}>
          Account
        </Button>
      </header>

      {/* grid-template-rows 0fr <-> 1fr gives a smooth height animation without measuring. */}
      <div className="collapse" id={bodyId} inert={collapsed}>
        <div className="collapse-inner">
          {p.conflicts.length > 0 && (
            <div className="card-body stack" style={{ paddingBottom: 0 }}>
              {p.conflicts.map((c) => (
                <Callout key={c} tone="warning">
                  {c}
                </Callout>
              ))}
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
                <span className="muted truncate">
                  <code>
                    {p.user}@{p.hosts[0]}
                  </code>{' '}
                  → <b>{p.active}</b>
                </span>
                <span className="spacer" />
                <Button size="sm" variant="ghost" loading={isBusy(`use:${p.id}`)} onClick={onDeactivate}>
                  Deactivate
                </Button>
              </>
            ) : (
              <span className="muted">
                No active account - plain <code>{p.hosts[0]}</code> URLs use your default SSH keys.
              </span>
            )}
          </footer>
        </div>
      </div>
    </section>
  );
}
