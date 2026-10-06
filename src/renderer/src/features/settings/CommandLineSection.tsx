import type { ReactNode } from 'react';
import { Copy, Terminal } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { Button } from '../../components/ui/Button';
import { Badge, CodeBlock } from '../../components/ui/Feedback';

const EXAMPLES = [
  'lanyard                      # open this app',
  'lanyard status',
  'lanyard use github work',
  'lanyard test --all',
  'lanyard hosts key prod id_ed25519_servers',
  'lny connect prod             # lny is a short alias',
];

const NPX = 'npx lanyard-ssh status';

/**
 * Settings > Command line: a reference, not an installer. The Windows
 * installer adds `lanyard` / `lny` to the PATH; elsewhere this explains the
 * one command to run.
 */
export function CommandLineSection() {
  const { data: s } = useResource(() => api.app.cliStatus());
  const { run } = useTask();
  const copy = (text: string) => run('copy', () => api.app.copy(text), 'Copied');
  const ready = !!s?.installed && s.onPath;

  let hint: ReactNode = null;
  if (s && !ready) {
    if (!s.packaged) {
      hint = <>Development build: run <code>npm link</code> in the project folder to get the commands.</>;
    } else if (s.installed && s.pathHint) {
      hint = <>Add <span className="mono">{s.binDir}</span> to your PATH: <code className="selectable">{s.pathHint}</code></>;
    } else if (s.installCommand) {
      hint = (
        <span className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          Run once to add them: <code className="selectable">{s.installCommand}</code>
          <Button size="sm" variant="ghost" iconOnly title="Copy" icon={<Copy size={14} />} onClick={() => void copy(s.installCommand!)} />
        </span>
      );
    }
  }

  return (
    <div className="card settings-section">
      <div className="settings-row">
        <div className="label">
          <div className="row" style={{ gap: 8, fontWeight: 700 }}>
            <Terminal size={16} /> <code>lanyard</code> and <code>lny</code> commands
          </div>
          <div className="faint">
            {ready ? 'Added to your PATH when Lanyard was installed - open a new terminal and run lanyard.' : hint}
          </div>
        </div>
        {s && <Badge tone={ready ? 'success' : 'warning'}>{ready ? 'On your PATH' : 'Not on PATH'}</Badge>}
      </div>

      <div className="card-body stack">
        <CodeBlock>{EXAMPLES.join('\n')}</CodeBlock>
        <div className="row faint" style={{ flexWrap: 'wrap' }}>
          <span>Without installing anything:</span>
          <code className="selectable">{NPX}</code>
          <Button size="sm" variant="ghost" iconOnly title="Copy" icon={<Copy size={14} />} onClick={() => void copy(NPX)} />
          <span>· add <code>--json</code> to any command for scripting.</span>
        </div>
      </div>
    </div>
  );
}
