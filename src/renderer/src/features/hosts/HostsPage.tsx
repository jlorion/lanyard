import { useState } from 'react';
import { Activity, Eye, Pencil, Plus, Server, SquareTerminal, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Checkbox, Segmented } from '../../components/ui/Field';
import { Badge, Callout, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { HostEditorModal } from './HostEditorModal';
import { ResolveModal } from './ResolveModal';
import { RawConfigEditor } from './RawConfigEditor';
import { Skeleton } from '../../components/ui/Skeleton';
import { useIntent } from '../../app/navigation';
import { HostKeySwitcher } from '../../components/domain/HostKeySwitcher';
import type { HostEntry } from '../../../../shared/types';

function target(h: HostEntry): string {
  if (!h.hostName && !h.user) return '';
  return `${h.user ? `${h.user}@` : ''}${h.hostName || h.alias}${h.port ? `:${h.port}` : ''}`;
}

export function HostsPage() {
  const [view, setView] = useState<'list' | 'raw'>('list');
  const { data: hosts = [], error, loading } = useResource(() => api.hosts.list(), ['config']);
  const { data: allKeys = [] } = useResource(() => api.keys.list(), ['keys']);
  const keys = allKeys.filter((k) => k.hasPrivate);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<HostEntry | 'new' | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { run, isBusy } = useTask();
  const toast = useToast();
  const confirm = useConfirm();
  useIntent('add-host', () => { setView('list'); setEditing('new'); });
  useIntent('raw-config', () => setView('raw'));

  const q = query.toLowerCase();
  const visible = hosts
    .filter((h) => showAll || (!h.managed && !h.isPattern))
    .filter((h) => !q || [h.patterns, h.hostName, h.user, h.comment].some((v) => v.toLowerCase().includes(q)));

  const test = async (h: HostEntry) => {
    const r = await run(`test:${h.managed}:${h.index}`, () => api.hosts.test(h.alias));
    if (!r) return;
    if (r.ok) toast.success(`${h.alias}: ${r.message}`);
    else toast.error(`${h.alias}: ${r.message}`);
  };

  const remove = async (h: HostEntry) => {
    const ok = await confirm({
      title: `Remove host ${h.alias}?`,
      message: <>The <code>Host {h.patterns}</code> block is removed from your SSH config. A backup is kept.</>,
      confirmLabel: 'Remove host',
      danger: true,
    });
    if (ok) await run(`rm:${h.index}`, () => api.hosts.remove(h.index, h.patterns), `Removed ${h.alias}`);
  };

  return (
    <>
      <PageHeader
        title="Hosts"
        description="Host entries in ~/.ssh/config. Edits keep your comments and formatting, and every change is backed up."
        actions={(
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'Hosts' }, { value: 'raw', label: 'Raw config' }]} />
            {view === 'list' && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>Add host</Button>}
          </>
        )}
      />

      {view === 'raw' ? <RawConfigEditor /> : (
        <>
          {error && <Callout tone="danger">{error}</Callout>}
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search hosts…" />
            <Checkbox checked={showAll} onChange={setShowAll} label="Show managed entries and patterns" />
          </div>

          {loading ? <Skeleton rows={4} /> : !visible.length ? (
            <EmptyState
              icon={<Server size={30} />}
              title={hosts.length ? 'No matching hosts' : 'No hosts yet'}
              action={!hosts.length && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>Add host</Button>}
            >
              {!hosts.length && 'Add servers you connect to so you can reach them with a short alias - from a terminal, from here, or from the tray.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Host</th>
                    <th>Target</th>
                    <th>SSH key</th>
                    <th className="actions" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((h) => (
                    <tr key={`${h.managed ? 'm' : 'u'}${h.index}`}>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          <span className="host-alias mono">{h.patterns}</span>
                          {h.managed && <Badge tone="accent" title="Generated from Git accounts">managed</Badge>}
                          {h.isPattern && <Badge>pattern</Badge>}
                        </div>
                        {h.comment && <div className="faint truncate" style={{ maxWidth: 360 }}>{h.comment}</div>}
                      </td>
                      <td className="host-target selectable">{target(h)}</td>
                      <td>
                        {h.managed || h.isPattern
                          ? <span className="mono faint">{h.identityFile.split(/[\\/]/).pop()}</span>
                          : <HostKeySwitcher host={h} keys={keys} />}
                      </td>
                      <td className="actions">
                        <div className="row">
                          {!h.isPattern && !h.managed && (
                            <Button size="sm" variant="ghost" icon={<SquareTerminal size={14} />} onClick={() => run(`c:${h.index}`, () => api.app.connect(h.alias))}>
                              Connect
                            </Button>
                          )}
                          {!h.isPattern && (
                            <Button size="sm" variant="ghost" iconOnly title="Test login (BatchMode)" icon={<Activity size={14} />} loading={isBusy(`test:${h.managed}:${h.index}`)} onClick={() => void test(h)} />
                          )}
                          {!h.isPattern && <Button size="sm" variant="ghost" iconOnly title="Effective config (ssh -G)" icon={<Eye size={14} />} onClick={() => setResolving(h.alias)} />}
                          {!h.managed && (
                            <>
                              <Button size="sm" variant="ghost" iconOnly title="Edit" icon={<Pencil size={14} />} onClick={() => setEditing(h)} />
                              <Button size="sm" variant="ghost" iconOnly danger title="Remove" icon={<Trash2 size={14} />} onClick={() => void remove(h)} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && <HostEditorModal host={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {resolving && <ResolveModal alias={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}
