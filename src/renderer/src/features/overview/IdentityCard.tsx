import { Activity, CircleAlert, CircleCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { useToast } from '../../components/feedback/ToastProvider';
import { Button } from '../../components/ui/Button';
import { ProviderMark } from '../../components/domain/ProviderMark';
import { timeAgo } from '../../lib/format';
import type { ProviderOverview } from '../../../../shared/types';

const NONE = '__none__';

/** "You are X on GitHub" with an inline switcher and a connection test. */
export function IdentityCard({ provider: p }: { provider: ProviderOverview }) {
  const { run, isBusy } = useTask();
  const toast = useToast();
  const active = p.accounts.find((a) => a.active);
  const last = active?.lastTest;

  const switchTo = (name: string) =>
    run('use', () => api.accounts.use(p.id, name === NONE ? null : name), (r) =>
      r.active ? `${p.name} now uses "${r.active}"` : `${p.name}: no active account`);

  const test = async () => {
    const r = await run('test', () => api.accounts.test(p.id));
    if (r) (r.ok ? toast.success : toast.error)(`${p.name}: ${r.message}${r.hint ? `\n${r.hint}` : ''}`);
  };

  return (
    <div className="identity-card">
      <div className="identity-head">
        <ProviderMark id={p.id} name={p.name} color={p.color} size={36} />
        <div style={{ minWidth: 0 }}>
          <div className="identity-provider">{p.name}</div>
          <div className="faint mono truncate">{p.user}@{p.hosts[0]}</div>
        </div>
      </div>

      <label className="identity-label" htmlFor={`identity-${p.id}`}>Signed in as</label>
      <select
        id={`identity-${p.id}`}
        className="select identity-select"
        value={p.active ?? NONE}
        disabled={isBusy('use')}
        onChange={(e) => void switchTo(e.target.value)}
      >
        {p.accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
        <option value={NONE}>No active account</option>
      </select>
      <div className="identity-email faint truncate" title={active?.gitEmail}>
        {active?.gitEmail || (active ? 'no git email set' : ' ')}
      </div>

      <div className="identity-foot">
        {last ? (
          <span className={`identity-status ${last.ok ? 'test-ok' : 'test-fail'}`} title={last.message}>
            {last.ok ? <CircleCheck size={14} /> : <CircleAlert size={14} />}
            <span className="truncate">
              {last.ok ? (last.username ? `verified as ${last.username}` : 'verified') : 'last test failed'} · {timeAgo(last.at)}
            </span>
          </span>
        ) : (
          <span className="identity-status faint">
            <span className="truncate">{active ? 'not tested yet' : 'plain URLs use default keys'}</span>
          </span>
        )}
        {active && (
          <Button size="sm" variant="ghost" icon={<Activity size={14} />} loading={isBusy('test')} onClick={() => void test()}>
            Test
          </Button>
        )}
      </div>
    </div>
  );
}
