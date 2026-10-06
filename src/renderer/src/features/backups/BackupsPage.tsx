import { useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Field';
import { Badge, Callout, CodeBlock, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { formatBytes, formatDateTime } from '../../lib/format';
import type { BackupKind } from '../../../../shared/types';

function BackupPreview({ id }: { id: string }) {
  const { data, error } = useResource(() => api.backups.read(id));
  if (error) return <Callout tone="danger">{error}</Callout>;
  return <CodeBlock maxHeight={560}>{data || ' '}</CodeBlock>;
}

export function BackupsPage() {
  const [kind, setKind] = useState<BackupKind>('config');
  const { data = [], error, loading, reload } = useResource(() => api.backups.list(), ['config', 'knownHosts']);
  const [selected, setSelected] = useState<string | null>(null);
  const { run, isBusy } = useTask();
  const confirm = useConfirm();

  const rows = data.filter((b) => b.kind === kind);

  const restore = async (id: string) => {
    const target = kind === 'config' ? '~/.ssh/config' : '~/.ssh/known_hosts';
    if (
      await confirm({
        title: 'Restore this backup?',
        message: (
          <>
            The current <code>{target}</code> is replaced. It is backed up first, so this can be undone.
          </>
        ),
        confirmLabel: 'Restore',
      })
    ) {
      await run('restore', () => api.backups.restore(id), 'Backup restored');
      await reload();
    }
  };

  return (
    <>
      <PageHeader
        title="Backups"
        description="A snapshot is taken before every change Lanyard makes to your SSH config or known_hosts."
        actions={
          <Segmented
            value={kind}
            onChange={(k) => {
              setKind(k);
              setSelected(null);
            }}
            options={[
              { value: 'config', label: 'SSH config' },
              { value: 'known_hosts', label: 'known_hosts' },
            ]}
          />
        }
      />

      {error && <Callout tone="danger">{error}</Callout>}

      {!loading && !rows.length ? (
        <EmptyState icon={<History size={30} />} title="No backups yet">
          Backups appear here after the first change.
        </EmptyState>
      ) : (
        <div className="split">
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
            {rows.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`list-item${selected === b.id ? ' active' : ''}`}
                onClick={() => setSelected(b.id)}
              >
                <span style={{ fontWeight: 600 }}>{formatDateTime(b.createdAt)}</span>
                <span className="row faint" style={{ gap: 6 }}>
                  {b.reason && <Badge>{b.reason}</Badge>}
                  {formatBytes(b.size)}
                </span>
              </button>
            ))}
          </div>
          <div className="stack">
            {selected ? (
              <>
                <div className="row">
                  <span className="mono faint truncate">{selected}</span>
                  <span className="spacer" />
                  <Button
                    variant="primary"
                    icon={<RotateCcw size={15} />}
                    loading={isBusy('restore')}
                    onClick={() => void restore(selected)}
                  >
                    Restore
                  </Button>
                </div>
                <BackupPreview key={selected} id={selected} />
              </>
            ) : (
              <EmptyState icon={<History size={26} />} title="Select a backup">
                Preview its contents and restore it.
              </EmptyState>
            )}
          </div>
        </div>
      )}
    </>
  );
}
