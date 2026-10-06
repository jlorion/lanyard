import { Activity, CircleCheck, Circle, Copy, FolderGit2, Lock, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
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

      <div className="account-actions">
        <Button size="sm" variant="ghost" icon={<Activity size={14} />} loading={testing} onClick={actions.onTest} title="Test with ssh -T">
          Test
        </Button>
        <Button size="sm" variant="ghost" iconOnly title="Copy public key" icon={<Copy size={14} />} onClick={actions.onCopyKey} />
        <Button size="sm" variant="ghost" iconOnly title="Clone / switch a repository" icon={<FolderGit2 size={14} />} onClick={actions.onRepo} />
        <Button size="sm" variant="ghost" iconOnly title="Edit" icon={<Pencil size={14} />} onClick={actions.onEdit} />
        <Button size="sm" variant="ghost" iconOnly danger title="Remove account" icon={<Trash2 size={14} />} onClick={actions.onRemove} />
      </div>
    </div>
  );
}
