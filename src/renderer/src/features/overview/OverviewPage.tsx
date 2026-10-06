import { useState, type ReactNode } from 'react';
import { ArrowRight, GitBranch, KeyRound, Plus, Server, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useNavigation } from '../../app/navigation';
import { useWorkspace } from '../../app/workspace';
import { Button } from '../../components/ui/Button';
import { EmptyState, PageHeader } from '../../components/ui/Feedback';
import { Skeleton } from '../../components/ui/Skeleton';
import { HostsTable } from '../hosts/HostsTable';
import { HostEditorModal } from '../hosts/HostEditorModal';
import { AddAccountFlow } from '../accounts/AddAccountFlow';
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
  const { providers, allHosts, keys, loading } = useWorkspace();
  const agent = useResource(() => api.agent.status(), ['keys']);
  const [addingServer, setAddingServer] = useState(false);
  const [addingAccount, setAddingAccount] = useState(false);

  const withAccounts = providers.filter((p) => p.accounts.length);
  const accountCount = withAccounts.reduce((n, p) => n + p.accounts.length, 0);
  // The tile mirrors the Hosts page groups (managed account entries included).
  const allServers = allHosts.filter((h) => !h.isPattern && !h.gitProvider).length;
  const allGitHosts = allHosts.filter((h) => !h.isPattern && h.gitProvider).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const go = (page: PageId) => () => navigate(page);

  return (
    <>
      <PageHeader
        title={greeting()}
        description="Who you are on each git host right now, and every host in your SSH config."
        actions={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddingAccount(true)}>Add account</Button>}
      />

      <div className="stat-row">
        <StatTile icon={<GitBranch size={18} />} label="Git accounts" value={accountCount}
          detail={`${withAccounts.length} provider${withAccounts.length === 1 ? '' : 's'}`} onClick={go('accounts')} />
        <StatTile
          icon={<Server size={18} />}
          label="Hosts"
          value={allHosts.length}
          detail={allGitHosts ? `${plural(allServers, 'server')} · ${plural(allGitHosts, 'git host')}` : 'in ~/.ssh/config'}
          onClick={go('hosts')}
        />
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
          action={<Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddingAccount(true)}>Add your first account</Button>}
        >
          Add a work and a personal account (or Hugging Face, GitLab…) and switch between them in one click.
        </EmptyState>
      )}

      <div className="section-head">
        <h2>Hosts</h2>
        <div className="row" style={{ gap: 4 }}>
          <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setAddingServer(true)}>Add server</Button>
          <Button size="sm" variant="ghost" onClick={go('hosts')}>All hosts <ArrowRight size={14} /></Button>
        </div>
      </div>
      <HostsTable compact onAddServer={() => setAddingServer(true)} />

      {addingServer && <HostEditorModal host={null} onClose={() => setAddingServer(false)} />}
      {addingAccount && <AddAccountFlow providers={providers} onClose={() => setAddingAccount(false)} />}
    </>
  );
}
