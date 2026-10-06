import type { ReactNode } from 'react';
import { Activity, Eye, GitBranch, Pencil, SquareTerminal, Trash2 } from 'lucide-react';
import { ActionMenu, type ActionItem } from '../../components/ui/ActionMenu';
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

/** Row actions by kind: servers connect, git hosts test, managed rows link to Git accounts. */
function menuItems(h: HostEntry, a: HostRowActions): ActionItem[] {
  const items: ActionItem[] = [];
  if (!h.isPattern && !h.gitProvider) {
    items.push({ label: 'Connect', icon: <SquareTerminal size={15} />, onSelect: a.onConnect });
    items.push({ label: 'Test login', icon: <Activity size={15} />, onSelect: a.onTest });
  }
  if (h.gitProvider) items.push({ label: 'Test (ssh -T)', icon: <Activity size={15} />, onSelect: a.onTest });
  if (!h.isPattern) items.push({ label: 'Effective config', icon: <Eye size={15} />, onSelect: a.onResolve });
  if (h.managed) {
    items.push({ label: 'Manage in Git accounts', icon: <GitBranch size={15} />, onSelect: a.onManageAccounts, separated: true });
  } else {
    items.push({ label: 'Edit', icon: <Pencil size={15} />, onSelect: a.onEdit, separated: items.length > 0 });
    items.push({ label: 'Remove', icon: <Trash2 size={15} />, onSelect: a.onRemove, danger: true });
  }
  return items;
}

/**
 * One Host block. Managed rows (generated from Git accounts) are read-only.
 * `status` fills the optional Status column (Git hosts table only).
 */
export function HostRow({ host: h, provider, status, keys, testing, actions }: {
  host: HostEntry;
  provider?: ProviderOverview;
  status?: ReactNode;
  keys: KeyInfo[];
  testing: boolean;
  actions: HostRowActions;
}) {
  return (
    <tr>
      <td>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          {provider && <ProviderMark id={provider.id} name={provider.name} color={provider.color} size={18} />}
          <span className="host-alias mono">{h.patterns}</span>
        </div>
        {h.comment && <div className="faint truncate" style={{ maxWidth: 380 }}>{h.comment}</div>}
      </td>
      <td className="host-target selectable">{target(h)}</td>
      <td>
        {h.managed || h.isPattern
          ? <span className="mono faint">{h.identityFile ? fileName(h.identityFile) : '-'}</span>
          : <HostKeySwitcher host={h} keys={keys} />}
      </td>
      {status !== undefined && <td className="host-status">{status}</td>}
      <td className="actions">
        <ActionMenu busy={testing} label={`Actions for ${h.alias}`} items={menuItems(h, actions)} />
      </td>
    </tr>
  );
}
