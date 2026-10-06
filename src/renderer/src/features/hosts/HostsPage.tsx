import { useState, type ReactNode } from 'react';
import { Plus, Server } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Field';
import { Callout, EmptyState, PageHeader } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { Skeleton } from '../../components/ui/Skeleton';
import { useIntent, useNavigation } from '../../app/navigation';
import { useWorkspace } from '../../app/workspace';
import { HostEditorModal } from './HostEditorModal';
import { ResolveModal } from './ResolveModal';
import { RawConfigEditor } from './RawConfigEditor';
import { HostRow } from './HostRow';
import type { HostEntry } from '../../../../shared/types';

const rowKey = (h: HostEntry) => `${h.managed ? 'm' : 'u'}${h.index}`;

function HostGroup({ title, description, count, children, empty }: {
  title: string;
  description: ReactNode;
  count: number;
  children: ReactNode;
  empty?: ReactNode;
}) {
  return (
    <section className="host-group">
      <div className="host-group-head">
        <h2>{title}</h2>
        <span className="nav-count">{count}</span>
        <span className="faint">{description}</span>
      </div>
      {count ? (
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
            <tbody>{children}</tbody>
          </table>
        </div>
      ) : empty}
    </section>
  );
}

export function HostsPage() {
  const [view, setView] = useState<'list' | 'raw'>('list');
  const { data: hosts = [], error, loading } = useResource(() => api.hosts.list(), ['config']);
  const { providers } = useWorkspace();
  const { navigate } = useNavigation();
  const { data: allKeys = [] } = useResource(() => api.keys.list(), ['keys']);
  const keys = allKeys.filter((k) => k.hasPrivate);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<HostEntry | 'new' | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { run, isBusy } = useTask();
  const toast = useToast();
  const confirm = useConfirm();
  useIntent('add-host', () => { setView('list'); setEditing('new'); });
  useIntent('raw-config', () => setView('raw'));

  const q = query.toLowerCase();
  const matches = (h: HostEntry) => !q || [h.patterns, h.hostName, h.user, h.comment].some((v) => v.toLowerCase().includes(q));
  const visible = hosts.filter(matches);

  // Aliases that Lanyard's managed section defines; user blocks reusing them are shadowed.
  const managedAliases = new Set(hosts.filter((h) => h.managed).flatMap((h) => h.aliases));
  const providerOf = (h: HostEntry) => providers.find((p) => p.id === h.gitProvider);
  const providerOrder = (h: HostEntry) => providers.findIndex((p) => p.id === h.gitProvider);

  const servers = visible.filter((h) => !h.isPattern && !h.gitProvider);
  const gitHosts = visible
    .filter((h) => !h.isPattern && h.gitProvider)
    .sort((a, b) => providerOrder(a) - providerOrder(b) || Number(b.managed) - Number(a.managed));
  const patterns = visible.filter((h) => h.isPattern);

  const test = async (h: HostEntry) => {
    const r = await run(`test:${rowKey(h)}`, () => api.hosts.test(h.alias));
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
    if (ok) await run(`rm:${rowKey(h)}`, () => api.hosts.remove(h.index, h.patterns), `Removed ${h.alias}`);
  };

  const row = (h: HostEntry) => {
    const provider = providerOf(h);
    const shadowed = !h.managed && h.aliases.some((a) => managedAliases.has(a));
    return (
      <HostRow
        key={rowKey(h)}
        host={h}
        provider={provider}
        overriddenBy={shadowed ? provider?.active ?? null : undefined}
        keys={keys}
        testing={isBusy(`test:${rowKey(h)}`)}
        actions={{
          onConnect: () => void run(`c:${rowKey(h)}`, () => api.app.connect(h.alias)),
          onTest: () => void test(h),
          onResolve: () => setResolving(h.alias),
          onEdit: () => setEditing(h),
          onRemove: () => void remove(h),
          onManageAccounts: () => navigate('accounts'),
        }}
      />
    );
  };

  return (
    <>
      <PageHeader
        title="Hosts"
        description="Every Host entry in ~/.ssh/config. Edits keep your comments and formatting, and every change is backed up."
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
          </div>

          {loading ? <Skeleton rows={4} /> : !hosts.length ? (
            <EmptyState
              icon={<Server size={30} />}
              title="No hosts yet"
              action={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setEditing('new')}>Add host</Button>}
            >
              Add servers you connect to so you can reach them with a short alias - from a terminal, from here, or from the tray.
            </EmptyState>
          ) : q && !visible.length ? (
            <EmptyState icon={<Server size={30} />} title="No matching hosts" />
          ) : (
            <div className="stack" style={{ gap: 24 }}>
              {(servers.length > 0 || !q) && (
                <HostGroup
                  title="Servers"
                  count={servers.length}
                  description="Machines you open a shell on"
                  empty={(
                    <div className="host-group-empty">
                      No servers yet.
                      <Button size="sm" icon={<Plus size={14} />} onClick={() => setEditing('new')}>Add server</Button>
                    </div>
                  )}
                >
                  {servers.map(row)}
                </HostGroup>
              )}
              {gitHosts.length > 0 && (
                <HostGroup title="Git hosts" count={gitHosts.length} description="Git over SSH, no shell - managed entries come from Git accounts">
                  {gitHosts.map(row)}
                </HostGroup>
              )}
              {patterns.length > 0 && (
                <HostGroup title="Patterns" count={patterns.length} description="Wildcard and Match blocks that apply to several hosts">
                  {patterns.map(row)}
                </HostGroup>
              )}
            </div>
          )}
        </>
      )}

      {editing && <HostEditorModal host={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {resolving && <ResolveModal alias={resolving} onClose={() => setResolving(null)} />}
    </>
  );
}
