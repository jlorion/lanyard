import { useState } from 'react';
import { Plus, Server, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { KeySelect } from '../../components/domain/KeySelect';
import type { HostEntry, HostOption } from '../../../../shared/types';

/** Options that get a dedicated form field; everything else is a free key/value row. */
const KNOWN = ['HostName', 'User', 'Port', 'IdentityFile', 'ProxyJump', 'ForwardAgent'] as const;
type Known = (typeof KNOWN)[number];

function split(options: HostOption[]) {
  const known: Record<Known, string> = { HostName: '', User: '', Port: '', IdentityFile: '', ProxyJump: '', ForwardAgent: '' };
  const seen = new Set<string>();
  const extra: HostOption[] = [];
  for (const o of options) {
    const k = KNOWN.find((x) => x.toLowerCase() === o.key.toLowerCase());
    if (k && !seen.has(k)) {
      seen.add(k);
      known[k] = o.value.replace(/^"|"$/g, '');
    } else {
      extra.push({ ...o });
    }
  }
  return { known, extra };
}

export function HostEditorModal({ host, onClose }: { host: HostEntry | null; onClose: () => void }) {
  const { run, isBusy } = useTask();
  const initial = split(host?.options ?? []);
  const [patterns, setPatterns] = useState(host?.patterns ?? '');
  const [comment, setComment] = useState(host?.comment ?? '');
  const [known, setKnown] = useState(initial.known);
  const [extra, setExtra] = useState<HostOption[]>(initial.extra);

  const setField = (k: Known, v: string) => setKnown((s) => ({ ...s, [k]: v }));
  const setExtraAt = (i: number, patch: Partial<HostOption>) =>
    setExtra((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const submit = async () => {
    const options: HostOption[] = [
      ...KNOWN.filter((k) => known[k].trim()).map((k) => ({ key: k, value: known[k].trim() })),
      ...extra.filter((o) => o.key.trim() && o.value.trim()),
    ];
    const ok = await run('save', () => api.hosts.save({
      index: host?.index ?? null,
      originalPatterns: host?.patterns,
      patterns: patterns.trim(),
      options,
      comment,
    }), host ? 'Host updated' : 'Host added');
    if (ok) onClose();
  };

  return (
    <Modal
      title={host ? `Edit ${host.alias}` : 'Add host'}
      icon={<Server size={18} />}
      onClose={onClose}
      onSubmit={submit}
      wide
      footer={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!patterns.trim()} loading={isBusy('save')}>
            {host ? 'Save changes' : 'Add host'}
          </Button>
        </>
      )}
    >
      <div className="form-grid">
        <Field label="Alias (Host)" hint="Name you type after ssh. Several aliases or patterns can be space-separated.">
          <Input mono value={patterns} placeholder="prod-web" onChange={(e) => setPatterns(e.target.value)} />
        </Field>
        <Field label="Comment" hint="Written as # lines above the block">
          <Input value={comment} placeholder="Production web server" onChange={(e) => setComment(e.target.value)} />
        </Field>
        <Field label="HostName" hint="Real hostname or IP address">
          <Input mono value={known.HostName} placeholder="203.0.113.10" onChange={(e) => setField('HostName', e.target.value)} />
        </Field>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 110px' }}>
          <Field label="User">
            <Input mono value={known.User} placeholder="deploy" onChange={(e) => setField('User', e.target.value)} />
          </Field>
          <Field label="Port">
            <Input mono value={known.Port} placeholder="22" inputMode="numeric" onChange={(e) => setField('Port', e.target.value.replace(/\D/g, ''))} />
          </Field>
        </div>
        <Field label="IdentityFile" className="full">
          <KeySelect value={known.IdentityFile} allowEmpty onChange={(v) => setField('IdentityFile', v)} />
        </Field>
        <Field label="ProxyJump" hint="Bastion host alias, e.g. jump">
          <Input mono value={known.ProxyJump} onChange={(e) => setField('ProxyJump', e.target.value)} />
        </Field>
        <Field label="ForwardAgent">
          <Select value={known.ForwardAgent} onChange={(e) => setField('ForwardAgent', e.target.value)}>
            <option value="">(default)</option>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </Select>
        </Field>

        <div className="field full">
          <span className="field-label">Other options</span>
          <div className="stack" style={{ gap: 6 }}>
            {extra.map((o, i) => (
              <div className="option-row" key={i}>
                <Input mono value={o.key} placeholder="ServerAliveInterval" onChange={(e) => setExtraAt(i, { key: e.target.value })} />
                <Input mono value={o.value} placeholder="60" onChange={(e) => setExtraAt(i, { value: e.target.value })} />
                <Button variant="ghost" iconOnly danger title="Remove option" icon={<Trash2 size={14} />} onClick={() => setExtra((rows) => rows.filter((_, j) => j !== i))} />
              </div>
            ))}
            <div>
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setExtra((rows) => [...rows, { key: '', value: '' }])}>Add option</Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
