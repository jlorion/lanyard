/**
 * The grouped hosts table (Servers / Git hosts / Patterns) shared by the Hosts
 * page and the Overview. It loads its own data, renders one row per git
 * account with an Active / Use / Overridden status, and owns the per-row
 * dialogs (edit, effective config).
 */

import { useState, type ReactNode } from 'react';
import { Plus, Server } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { Button } from '../../components/ui/Button';
import { Badge, Callout, EmptyState } from '../../components/ui/Feedback';
import { Skeleton } from '../../components/ui/Skeleton';
import { useNavigation } from '../../app/navigation';
import { useWorkspace } from '../../app/workspace';
import { HostEditorModal } from './HostEditorModal';
import { ResolveModal } from './ResolveModal';
import { HostRow } from './HostRow';
import type { HostEntry } from '../../../../shared/types';

const rowKey = (h: HostEntry) => `${h.managed ? 'm' : 'u'}${h.index}`;

function HostGroup({
  title,
  description,
  count,
  children,
  empty,
  withStatus,
}: {
  title: string;
  description: ReactNode;
  count: number;
  children: ReactNode;
  empty?: ReactNode;
  withStatus?: boolean;
}) {
  return (
    <section className="host-group">
      <div className="host-group-head">
        <h3>{title}</h3>
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
                {withStatus && <th>Status</th>}
                <th className="actions" />
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      ) : (
        empty
      )}
    </section>
  );
}

export function HostsTable({
  query = '',
  compact = false,
  onAddServer,
}: {
  query?: string;
  /** Overview mode: no Patterns group and no empty Servers placeholder. */
  compact?: boolean;
  onAddServer: () => void;
}) {
  const { data: hosts = [], error, loading } = useResource(() => api.hosts.list(), ['config']);
  const { data: allKeys = [] } = useResource(() => api.keys.list(), ['keys']);
  const keys = allKeys.filter((k) => k.hasPrivate);
  const { providers } = useWorkspace();
  const { navigate } = useNavigation();
  const [editing, setEditing] = useState<HostEntry | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { run, isBusy } = useTask();
  const toast = useToast();
  const confirm = useConfirm();

  const q = query.toLowerCase();
  const visible = hosts.filter((h) => !q || [h.patterns, h.hostName, h.user, h.comment].some((v) => v.toLowerCase().includes(q)));

  // Aliases that Lanyard's managed section defines; user blocks reusing them are shadowed.
  const managedAliases = new Set(hosts.filter((h) => h.managed).flatMap((h) => h.aliases));
  const providerOf = (h: HostEntry) => providers.find((p) => p.id === h.gitProvider);
  const accountOf = (h: HostEntry) => providerOf(h)?.accounts.find((a) => a.alias === h.alias);

  // One row per account (its alias block) plus the user's own git blocks. The
  // managed "active switch" block (Host github.com -> active key) is what the
  // Active status means, so it isn't listed separately.
  // Order is stable - provider, then the order accounts were added, then the
  // user's own blocks - so switching accounts never moves rows around.
  const gitRank = (h: HostEntry) => {
    const provider = providerOf(h);
    const i = provider?.accounts.findIndex((a) => a.alias === h.alias) ?? -1;
    return i >= 0 ? i : Number.MAX_SAFE_INTEGER;
  };
  const gitHosts = visible
    .filter((h) => !h.isPattern && h.gitProvider && (!h.managed || accountOf(h)))
    .sort(
      (a, b) =>
        providers.findIndex((p) => p.id === a.gitProvider) - providers.findIndex((p) => p.id === b.gitProvider) || gitRank(a) - gitRank(b),
    );
  const servers = visible.filter((h) => !h.isPattern && !h.gitProvider);
  const patterns = compact ? [] : visible.filter((h) => h.isPattern);

  const gitStatus = (h: HostEntry): ReactNode => {
    const provider = providerOf(h);
    const account = accountOf(h);
    if (account && provider) {
      if (account.active) {
        return (
          <Badge tone="success" title={`Plain ${provider.user}@${provider.hosts[0]} URLs use this account`}>
            Active
          </Badge>
        );
      }
      return (
        <Button
          size="sm"
          variant="ghost"
          loading={isBusy(`use:${account.id}`)}
          title={`Make ${account.name} the active ${provider.name} account`}
          onClick={() =>
            void run(`use:${account.id}`, () => api.accounts.use(provider.id, account.name), `${provider.name} now uses "${account.name}"`)
          }
        >
          Use
        </Button>
      );
    }
    if (h.aliases.some((a) => managedAliases.has(a))) {
      const why = provider?.active
        ? `Lanyard's ${provider.name} account (${provider.active}) is applied first; this block's key is only offered as a fallback.`
        : 'A Lanyard entry for this host is applied first.';
      return (
        <Badge tone="warning" title={why}>
          Overridden
        </Badge>
      );
    }
    return <span className="faint">-</span>;
  };

  const test = async (h: HostEntry) => {
    const r = await run(`test:${rowKey(h)}`, () => api.hosts.test(h.alias));
    if (r) toast[r.ok ? 'success' : 'error'](`${h.alias}: ${r.message}`);
  };

  const remove = async (h: HostEntry) => {
    const ok = await confirm({
      title: `Remove host ${h.alias}?`,
      message: (
        <>
          The <code>Host {h.patterns}</code> block is removed from your SSH config. A backup is kept.
        </>
      ),
      confirmLabel: 'Remove host',
      danger: true,
    });
    if (ok) await run(`rm:${rowKey(h)}`, () => api.hosts.remove(h.index, h.patterns), `Removed ${h.alias}`);
  };

  const row = (h: HostEntry, withStatus = false) => (
    <HostRow
      key={rowKey(h)}
      host={h}
      provider={providerOf(h)}
      status={withStatus ? gitStatus(h) : undefined}
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

  if (loading) return <Skeleton rows={3} />;
  if (error) return <Callout tone="danger">{error}</Callout>;
  if (!hosts.length) {
    return (
      <EmptyState
        icon={<Server size={30} />}
        title="No hosts yet"
        action={
          <Button variant="primary" icon={<Plus size={15} />} onClick={onAddServer}>
            Add host
          </Button>
        }
      >
        Add servers you connect to so you can reach them with a short alias - from a terminal, from here, or from the tray.
      </EmptyState>
    );
  }
  if (q && !visible.length) return <EmptyState icon={<Server size={30} />} title="No matching hosts" />;

  const showServers = servers.length > 0 || (!q && !compact);
  return (
    <div className="stack" style={{ gap: 24 }}>
      {showServers && (
        <HostGroup
          title="Servers"
          count={servers.length}
          description="Machines you open a terminal on"
          empty={
            <div className="host-group-empty">
              No servers yet - add a VPS, work machine or Raspberry Pi to connect in one click.
              <Button size="sm" icon={<Plus size={14} />} onClick={onAddServer}>
                Add server
              </Button>
            </div>
          }
        >
          {servers.map((h) => row(h))}
        </HostGroup>
      )}
      {gitHosts.length > 0 && (
        <HostGroup
          withStatus
          title="Git hosts"
          count={gitHosts.length}
          description="One row per account; the active one is what plain git URLs use"
        >
          {gitHosts.map((h) => row(h, true))}
        </HostGroup>
      )}
      {patterns.length > 0 && (
        <HostGroup title="Patterns" count={patterns.length} description="Wildcard and Match blocks that apply to several hosts">
          {patterns.map((h) => row(h))}
        </HostGroup>
      )}

      {editing && <HostEditorModal host={editing} onClose={() => setEditing(null)} />}
      {resolving && <ResolveModal alias={resolving} onClose={() => setResolving(null)} />}
    </div>
  );
}
