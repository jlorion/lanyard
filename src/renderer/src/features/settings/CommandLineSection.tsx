import { CircleCheck, Copy, Terminal, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useAppInfo } from '../../app/AppInfoContext';
import { Button } from '../../components/ui/Button';
import { Callout, CodeBlock } from '../../components/ui/Feedback';

const EXAMPLES = [
  'lanyard                      # open this app',
  'lanyard status',
  'lanyard use github work',
  'lanyard test --all',
  'lanyard hosts key prod id_ed25519_servers',
  'lny connect prod             # lny is a short alias',
];

const NPX = 'npx lanyard-ssh status';

/** Settings > Command line: install `lanyard` / `lny` on PATH from the app. */
export function CommandLineSection() {
  const { platform } = useAppInfo();
  const status = useResource(() => api.app.cliStatus());
  const { run, isBusy } = useTask();
  const s = status.data;

  const install = async () => {
    const r = await run('install', () => api.app.installCli());
    if (!r) return;
    await status.reload();
  };
  const uninstall = async () => {
    await run('uninstall', () => api.app.uninstallCli(), '`lanyard` command removed');
    await status.reload();
  };

  return (
    <div className="card settings-section">
      <div className="settings-row">
        <div className="label">
          <div className="row" style={{ gap: 8, fontWeight: 700 }}>
            <Terminal size={16} /> <code>lanyard</code> and <code>lny</code> commands
          </div>
          <div className="faint">
            {s?.installed
              ? <span className="row" style={{ gap: 5 }}><CircleCheck size={13} style={{ color: 'var(--success)' }} /> Installed in <span className="mono selectable">{s.binDir}</span></span>
              : 'Use every feature from any terminal. No Node.js or npm required.'}
          </div>
        </div>
        {s?.installed ? (
          <>
            <Button size="sm" loading={isBusy('install')} onClick={() => void install()}>Reinstall</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} loading={isBusy('uninstall')} onClick={() => void uninstall()}>Uninstall</Button>
          </>
        ) : (
          <Button variant="primary" size="sm" loading={isBusy('install') || status.loading} onClick={() => void install()}>Install command</Button>
        )}
      </div>

      <div className="card-body stack">
        {s?.installed && s.onPath && platform === 'win32' && (
          <Callout tone="success">Ready. Open a new terminal window and run <code>lanyard</code>; terminals that were already open keep their old PATH.</Callout>
        )}
        {s?.installed && !s.onPath && s.pathHint && (
          <Callout tone="warning">
            <div><span className="mono">{s.binDir}</span> is not on your PATH yet. Add this line to your shell profile (<code>~/.zshrc</code> or <code>~/.bashrc</code>):</div>
            <div className="row" style={{ marginTop: 6 }}>
              <code className="selectable">{s.pathHint}</code>
              <Button size="sm" variant="ghost" iconOnly title="Copy" icon={<Copy size={14} />} onClick={() => run('copy', () => api.app.copy(s.pathHint!), 'Copied')} />
            </div>
          </Callout>
        )}
        {status.error && <Callout tone="danger">{status.error}</Callout>}

        <CodeBlock>{EXAMPLES.join('\n')}</CodeBlock>
        <div className="row faint" style={{ flexWrap: 'wrap' }}>
          <span>Without installing anything:</span>
          <code className="selectable">{NPX}</code>
          <Button size="sm" variant="ghost" iconOnly title="Copy" icon={<Copy size={14} />} onClick={() => run('copy-npx', () => api.app.copy(NPX), 'Copied')} />
          <span>· add <code>--json</code> to any command for scripting.</span>
        </div>
      </div>
    </div>
  );
}
