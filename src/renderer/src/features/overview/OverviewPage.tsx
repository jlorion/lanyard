import type { ReactNode } from 'react';
import { ArrowRight, GitBranch, KeyRound, Plus, Server, ShieldCheck, SquareTerminal } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useNavigation } from '../../app/navigation';
import { useWorkspace } from '../../app/workspace';
import { Button } from '../../components/ui/Button';
import { EmptyState, PageHeader } from '../../components/ui/Feedback';
import { Skeleton } from '../../components/ui/Skeleton';
import { HostKeySwitcher } from '../../components/domain/HostKeySwitcher';
import { IdentityCard } from './IdentityCard';
import type { PageId } from '../../app/pages';

function StatTile({ icon, label, value, detail, tone, onClick }: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: 'success' | 'warning';
  onClick: () => void;
}) {
  return (
    <button type="button" className={`stat-tile${tone ? ` ${tone}` : ''}`} onClick={onClick}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {detail && <span className="stat-detail">{detail}</span>}
    </button>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function OverviewPage() {
  const { navigate } = useNavigation();
  const { providers, hosts, keys, loading } = useWorkspace();
  const agent = useResource(() => api.agent.status(), ['keys']);
  const { run } = useTask();

  const withAccounts = providers.filter((p) => p.accounts.length);
  const accountCount = withAccounts.reduce((n, p) => n + p.accounts.length, 0);
  // Git hosts are covered by the identity cards; the host list is for servers you open shells on.
  const servers = hosts.filter((h) => !h.gitProvider);
  const go = (page: PageId) => () => navigate(page);

  return (
    <>
      <PageHeader
        title={greeting()}
        description="Here's who you are on each git host right now, and the servers you reach most."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate('accounts', 'add-account')}>Add account</Button>}
      />

      <div className="stat-row">
        <StatTile icon={<GitBranch size={18} />} label="Git accounts" value={accountCount}
          detail={`${withAccounts.length} provider${withAccounts.length === 1 ? '' : 's'}`} onClick={go('accounts')} />
        <StatTile icon={<Server size={18} />} label="Hosts" value={hosts.length} detail="in ~/.ssh/config" onClick={go('hosts')} />
        <StatTile icon={<KeyRound size={18} />} label="Keys" value={keys.length}
          detail={`${keys.filter((k) => k.encrypted).length} with passphrase`} onClick={go('keys')} />
        <StatTile
          icon={<ShieldCheck size={18} />}
          label="ssh-agent"
          value={agent.data ? (agent.data.running ? agent.data.identities.length : 'off') : '…'}
          detail={agent.data ? (agent.data.running ? 'keys loaded' : 'not running') : ''}
          tone={agent.data ? (agent.data.running ? 'success' : 'warning') : undefined}
          onClick={go('agent')}
        />
      </div>

      <div className="section-head">
        <h2>Identities</h2>
        <Button size="sm" variant="ghost" onClick={go('accounts')}>Manage <ArrowRight size={14} /></Button>
      </div>
      {loading ? <Skeleton rows={1} height={150} /> : withAccounts.length ? (
        <div className="identity-grid">
          {withAccounts.map((p) => <IdentityCard key={p.id} provider={p} />)}
        </div>
      ) : (
        <EmptyState
          icon={<GitBranch size={30} />}
          title="No git accounts yet"
          action={<Button variant="primary" icon={<Plus size={15} />} onClick={() => navigate('accounts', 'add-account')}>Add your first account</Button>}
        >
          Add a work and a personal account (or Hugging Face, GitLab…) and switch between them in one click.
        </EmptyState>
      )}

      <div className="section-head">
        <h2>Hosts</h2>
        <Button size="sm" variant="ghost" onClick={go('hosts')}>All hosts <ArrowRight size={14} /></Button>
      </div>
      {loading ? <Skeleton rows={3} /> : servers.length ? (
        <div className="host-list">
          {servers.slice(0, 6).map((h) => (
            <div key={h.index} className="host-row">
              <span className="host-avatar"><Server size={16} /></span>
              <div className="host-main">
                <div className="host-alias">{h.alias}</div>
                <div className="faint mono truncate">{[h.user, h.hostName].filter(Boolean).join('@') || h.alias}{h.port ? `:${h.port}` : ''}</div>
              </div>
              <HostKeySwitcher host={h} keys={keys} />
              <Button size="sm" icon={<SquareTerminal size={14} />} onClick={() => run(`c:${h.alias}`, () => api.app.connect(h.alias))}>Connect</Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Server size={30} />}
          title="No hosts yet"
          action={<Button icon={<Plus size={15} />} onClick={() => navigate('hosts', 'add-host')}>Add host</Button>}
        >
          Save servers you connect to and give each one its own key.
        </EmptyState>
      )}
    </>
  );
}
