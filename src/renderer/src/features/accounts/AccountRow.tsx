import { Activity, ArrowRightLeft, CircleCheck, Circle, Copy, FolderGit2, Lock, Pencil, Trash2 } from 'lucide-react';
import { ActionMenu } from '../../components/ui/ActionMenu';
import { Badge } from '../../components/ui/Feedback';
import { timeAgo } from '../../lib/format';
import type { AccountView } from '../../../../shared/types';

export interface AccountRowActions {
  onUse: () => void;
  onTest: () => void;
  onCopyKey: () => void;
  onRepo: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

export function AccountRow({ account, user, testing, switching, actions }: {
  account: AccountView;
  user: string;
  testing: boolean;
  switching: boolean;
  actions: AccountRowActions;
}) {
  const t = account.lastTest;
  return (
    <div className={`account-row${account.active ? ' active' : ''}`}>
      <button
        type="button"
        className="account-radio"
        title={account.active ? 'Active account' : 'Use this account'}
        aria-pressed={account.active}
        disabled={account.active || switching}
        onClick={actions.onUse}
      >
        {account.active ? <CircleCheck size={19} /> : <Circle size={19} />}
      </button>

      <div className="account-main">
        <div className="row" style={{ gap: 6 }}>
          <span className="account-name">{account.name}</span>
          {account.active && <Badge tone="accent">active</Badge>}
          {account.keyEncrypted && <Badge title="Key has a passphrase"><Lock size={11} /> passphrase</Badge>}
          {!account.keyExists && <Badge tone="danger">key missing</Badge>}
        </div>
        <div className="account-meta">
          <code className="selectable">{user}@{account.alias}</code>
          {account.gitEmail && <span className="truncate">{account.gitEmail}</span>}
          {t && (
            <span className={t.ok ? 'test-ok' : 'test-fail'} title={t.message}>
              {t.ok ? `✓ ${t.username || 'ok'}` : '✗ failed'} · {timeAgo(t.at)}
            </span>
          )}
        </div>
      </div>

      <ActionMenu
        busy={testing || switching}
        label={`Actions for ${account.name}`}
        items={[
          ...(account.active ? [] : [{ label: 'Use this account', icon: <ArrowRightLeft size={15} />, onSelect: actions.onUse }]),
          { label: 'Test (ssh -T)', icon: <Activity size={15} />, onSelect: actions.onTest },
          { label: 'Copy public key', icon: <Copy size={15} />, onSelect: actions.onCopyKey },
          { label: 'Clone / switch a repository', icon: <FolderGit2 size={15} />, onSelect: actions.onRepo },
          { label: 'Edit', icon: <Pencil size={15} />, onSelect: actions.onEdit, separated: true },
          { label: 'Remove account', icon: <Trash2 size={15} />, onSelect: actions.onRemove, danger: true },
        ]}
      />
    </div>
  );
}
