import { Activity, Eye, GitBranch, Pencil, SquareTerminal, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Feedback';
import { HostKeySwitcher } from '../../components/domain/HostKeySwitcher';
import { ProviderMark } from '../../components/domain/ProviderMark';
import type { HostEntry, KeyInfo, ProviderOverview } from '../../../../shared/types';

export interface HostRowActions {
  onConnect: () => void;
  onTest: () => void;
  onResolve: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onManageAccounts: () => void;
}

function target(h: HostEntry): string {
  if (!h.hostName && !h.user) return '';
  return `${h.user ? `${h.user}@` : ''}${h.hostName || h.alias}${h.port ? `:${h.port}` : ''}`;
}

const fileName = (p: string) => p.split(/[\\/]/).pop() ?? p;

/**
 * One Host block. Managed rows (generated from Git accounts) are read-only;
 * a user block that a managed block shadows is flagged "overridden".
 */
export function HostRow({ host: h, provider, overriddenBy, keys, testing, actions }: {
  host: HostEntry;
  provider?: ProviderOverview;
  /** Active account whose managed block takes priority over this user block. */
  overriddenBy?: string | null;
  keys: KeyInfo[];
  testing: boolean;
  actions: HostRowActions;
}) {
  const canShell = !h.isPattern && !h.gitProvider;
  return (
    <tr>
      <td>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {provider && <ProviderMark id={provider.id} name={provider.name} color={provider.color} size={18} />}
          <span className="host-alias mono">{h.patterns}</span>
          {h.managed && <Badge tone="accent" title="Generated from Git accounts; change it there">managed</Badge>}
          {overriddenBy !== undefined && (
            <Badge
              tone="warning"
              title={overriddenBy
                ? `Lanyard's ${provider?.name ?? 'account'} switch (${overriddenBy}) is applied first; this block's key is only offered as a fallback.`
                : 'A Lanyard account entry for this host is applied first.'}
            >
              overridden
            </Badge>
          )}
        </div>
        {h.comment && <div className="faint truncate" style={{ maxWidth: 380 }}>{h.comment}</div>}
      </td>
      <td className="host-target selectable">{target(h)}</td>
      <td>
        {h.managed || h.isPattern
          ? <span className="mono faint">{h.identityFile ? fileName(h.identityFile) : '-'}</span>
          : <HostKeySwitcher host={h} keys={keys} />}
      </td>
      <td className="actions">
        <div className="row">
          {canShell && (
            <Button size="sm" variant="ghost" icon={<SquareTerminal size={14} />} onClick={actions.onConnect}>Connect</Button>
          )}
          {/* Git hosts have no shell, so their primary action is the ssh -T login test. */}
          {h.gitProvider && (
            <Button size="sm" variant="ghost" icon={<Activity size={14} />} loading={testing} onClick={actions.onTest}>Test</Button>
          )}
          {canShell && (
            <Button size="sm" variant="ghost" iconOnly title="Test login (BatchMode)" icon={<Activity size={14} />} loading={testing} onClick={actions.onTest} />
          )}
          {!h.isPattern && <Button size="sm" variant="ghost" iconOnly title="Effective config (ssh -G)" icon={<Eye size={14} />} onClick={actions.onResolve} />}
          {h.managed ? (
            <Button size="sm" variant="ghost" iconOnly title="Manage in Git accounts" icon={<GitBranch size={14} />} onClick={actions.onManageAccounts} />
          ) : (
            <>
              <Button size="sm" variant="ghost" iconOnly title="Edit" icon={<Pencil size={14} />} onClick={actions.onEdit} />
              <Button size="sm" variant="ghost" iconOnly danger title="Remove" icon={<Trash2 size={14} />} onClick={actions.onRemove} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
