import { useEffect, useRef } from 'react';
import { Copy } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Feedback';
import { Skeleton } from '../../components/ui/Skeleton';
import { LanyardMark } from '../../components/brand/LanyardMark';
import type { AboutInfo } from '../../../../shared/ipc';

function versionReport(a: AboutInfo): string {
  return [
    `${a.name} ${a.version}${a.packaged ? '' : ' (development build)'}`,
    `Electron ${a.runtime.electron} · Chromium ${a.runtime.chrome} · Node ${a.runtime.node}`,
    `OpenSSH: ${a.tools.ssh ?? 'not found'}`,
    `Git: ${a.tools.git ?? 'not found'}`,
    `OS: ${a.os}`,
  ].join('\n');
}

/** The npm description starts with the name ("Lanyard: ..."), which the heading already shows. */
function tagline(a: AboutInfo): string {
  const prefix = `${a.name}:`;
  const text = a.description.startsWith(prefix) ? a.description.slice(prefix.length).trimStart() : a.description;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Settings > About: what this build is and what it runs on. */
export function AboutSection({
  focus = false,
  onFocused,
}: {
  /** Scroll into view once loaded (the sidebar version opens Settings here). */
  focus?: boolean;
  onFocused?: () => void;
}) {
  const about = useResource(() => api.app.about());
  const { run } = useTask();
  const ref = useRef<HTMLDivElement>(null);
  const a = about.data;

  // Wait for the data: scrolling earlier lands short once the card grows.
  useEffect(() => {
    if (!focus || !a) return;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onFocused?.();
  }, [focus, a, onFocused]);

  return (
    <div ref={ref} className="card settings-section about">
      {!a ? (
        <div className="card-body">
          <Skeleton rows={2} height={40} />
        </div>
      ) : (
        <>
          <div className="about-head">
            <LanyardMark size={56} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="about-name">{a.name}</span>
                <Badge tone="accent">v{a.version}</Badge>
                {!a.packaged && <Badge>development build</Badge>}
              </div>
              <p className="muted about-description">{tagline(a)}</p>
            </div>
          </div>

          <dl className="about-grid">
            <dt>Version</dt>
            <dd className="mono selectable">{a.version}</dd>
            <dt>Electron</dt>
            <dd className="mono selectable">
              {a.runtime.electron}{' '}
              <span className="faint">
                · Chromium {a.runtime.chrome} · Node {a.runtime.node}
              </span>
            </dd>
            <dt>OpenSSH</dt>
            <dd className="mono selectable">{a.tools.ssh ?? <span className="test-fail">not found on PATH</span>}</dd>
            <dt>Git</dt>
            <dd className="mono selectable">{a.tools.git ?? <span className="test-fail">not found on PATH</span>}</dd>
            <dt>System</dt>
            <dd className="mono selectable">{a.os}</dd>
            <dt>License</dt>
            <dd>
              {a.license} <span className="faint">· provider logos from Simple Icons (CC0), trademarks of their owners</span>
            </dd>
          </dl>

          <div className="card-footer">
            <span className="faint">Include this when reporting a problem.</span>
            <span className="spacer" />
            <Button
              size="sm"
              icon={<Copy size={14} />}
              onClick={() => run('copy', () => api.app.copy(versionReport(a)), 'Version info copied')}
            >
              Copy version info
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
