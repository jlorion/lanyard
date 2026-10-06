import { useEffect, useState } from 'react';
import { CheckCircle2, RotateCcw, Save } from 'lucide-react';
import { api, ApiError } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useConfirm } from '../../components/feedback/ConfirmProvider';
import { useToast } from '../../components/feedback/ToastProvider';
import { Button } from '../../components/ui/Button';
import { Textarea } from '../../components/ui/Field';
import { Callout } from '../../components/ui/Feedback';
import { useAppInfo } from '../../app/AppInfoContext';

export function RawConfigEditor() {
  const { paths } = useAppInfo();
  const { data: saved = '', reload } = useResource(() => api.hosts.getRaw(), ['config']);
  const [text, setText] = useState(saved);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState('');
  const { run, isBusy } = useTask();
  const confirm = useConfirm();
  const toast = useToast();

  // Follow changes on disk until the user starts editing.
  useEffect(() => {
    if (!dirty) setText(saved);
  }, [saved, dirty]);

  const validate = async () => {
    const r = await run('validate', () => api.hosts.validate(text));
    if (!r) return;
    setProblem(r.ok ? '' : r.error ?? 'Invalid config');
    if (r.ok) toast.success(r.skipped ? 'ssh not found - validation skipped' : 'OpenSSH accepts this config');
  };

  const saveWith = (force: boolean) =>
    api.hosts.saveRaw(text, { force }).then(() => null, (err: unknown) => err);

  const save = async () => {
    let failure = await saveWith(false);
    if (failure instanceof ApiError && failure.code === 'INVALID_CONFIG') {
      const force = await confirm({
        title: 'OpenSSH rejects this config',
        message: <pre className="code-block">{failure.message}</pre>,
        confirmLabel: 'Save anyway',
        danger: true,
      });
      if (!force) return;
      failure = await saveWith(true);
    }
    if (failure) {
      setProblem(failure instanceof Error ? failure.message : String(failure));
      return;
    }
    toast.success('SSH config saved');
    setDirty(false);
    setProblem('');
    await reload();
  };

  return (
    <div className="stack">
      <div className="row">
        <span className="muted mono truncate">{paths.config}</span>
        <span className="spacer" />
        {dirty && <Button variant="ghost" icon={<RotateCcw size={15} />} onClick={() => { setDirty(false); setProblem(''); setText(saved); }}>Discard</Button>}
        <Button icon={<CheckCircle2 size={15} />} loading={isBusy('validate')} onClick={() => void validate()}>Validate</Button>
        <Button variant="primary" icon={<Save size={15} />} disabled={!dirty} onClick={() => void save()}>Save</Button>
      </div>
      <Callout>A backup is taken before every save. The block between the <code>lanyard managed section</code> markers is regenerated from your git accounts.</Callout>
      {problem && <Callout tone="danger"><pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{problem}</pre></Callout>}
      <Textarea
        className="raw-editor"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />
    </div>
  );
}
