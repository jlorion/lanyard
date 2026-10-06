import { useState, type ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { useTask } from '../../hooks/useTask';
import { useAppInfo } from '../../app/AppInfoContext';
import { Button } from '../../components/ui/Button';
import { Input, Segmented, Select } from '../../components/ui/Field';
import { AccentPicker } from '../../components/appearance/AccentPicker';
import { useAppearance } from '../../app/appearance';
import type { ThemeMode } from '../../lib/appearance';
import { PageHeader } from '../../components/ui/Feedback';
import { Switch } from '../../components/ui/Switch';
import { CommandLineSection } from './CommandLineSection';
import { AboutSection } from './AboutSection';
import { useIntent } from '../../app/navigation';
import type { Settings } from '../../../../shared/types';

const WINDOWS_OPENSSH = 'C:/Windows/System32/OpenSSH/ssh.exe';

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="label">
        <div style={{ fontWeight: 600 }}>{title}</div>
        {description && <div className="faint">{description}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const info = useAppInfo();
  // The version in the sidebar footer opens Settings scrolled to About.
  const [focusAbout, setFocusAbout] = useState(false);
  useIntent('about', () => setFocusAbout(true));
  const settings = useResource(() => api.settings.get(), ['state']);
  const identity = useResource(() => api.git.identity());
  const { run } = useTask();
  const s = settings.data;
  const { theme, accent, setTheme, setAccent } = useAppearance();

  const update = async (patch: Partial<Settings>) => {
    await run('settings', () => api.settings.update(patch));
    await settings.reload();
  };

  const setSshCommand = async (command: string) => {
    await run('git', () => api.git.setSshCommand(command), command ? 'Git now uses Windows OpenSSH' : 'core.sshCommand removed');
    await identity.reload();
  };

  return (
    <>
      <PageHeader title="Settings" description="Preferences are stored in ~/.lanyard/state.json and shared with the lanyard CLI." />

      <div className="section-title">Appearance</div>
      <div className="card settings-section">
        <Row title="Theme" description="Follow the system, or always use light or dark.">
          <Segmented<ThemeMode>
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Row>
        <Row title="Accent colour" description="Used for the active page, primary buttons, focus rings and selections.">
          <AccentPicker value={accent} onChange={setAccent} />
        </Row>
      </div>

      {s && (
        <>
          <div className="section-title">Window &amp; tray</div>
          <div className="card settings-section">
            <Row title="Keep running in the tray when closed" description="Closing the window hides it; quit from the tray menu.">
              <Switch label="Close to tray" checked={s.closeToTray} onChange={(v) => void update({ closeToTray: v })} />
            </Row>
            <Row title="Start hidden" description="Launch straight into the tray without opening the window.">
              <Switch label="Start hidden" checked={s.startHidden} onChange={(v) => void update({ startHidden: v })} />
            </Row>
            <Row title="Start at login" description="Starts hidden in the tray when you sign in.">
              <Switch label="Start at login" checked={s.launchAtLogin} onChange={(v) => void update({ launchAtLogin: v })} />
            </Row>
          </div>

          <div className="section-title">Behaviour</div>
          <div className="card settings-section">
            <Row title="Terminal" description="Used for Connect and for typing key passphrases.">
              <Select value={s.terminal} style={{ width: 200 }} onChange={(e) => void update({ terminal: e.target.value })}>
                {info.terminalChoices.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Row>
            <Row title="Backups to keep" description="Per file (config and known_hosts).">
              <Input
                type="number"
                min={1}
                max={500}
                defaultValue={s.backupLimit}
                style={{ width: 100 }}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n !== s.backupLimit) void update({ backupLimit: Math.round(n) });
                }}
              />
            </Row>
          </div>
        </>
      )}

      <div className="section-title">Git</div>
      <div className="card settings-section">
        <Row title="Global identity" description="Updated on switch for accounts with “set git identity” enabled.">
          <span className="mono selectable">{identity.data ? `${identity.data.name || '-'} <${identity.data.email || '-'}>` : '…'}</span>
        </Row>
        <Row
          title="core.sshCommand"
          description={
            info.platform === 'win32'
              ? 'Point git at Windows OpenSSH so it shares the Windows ssh-agent service.'
              : 'Custom ssh binary git uses.'
          }
        >
          <span className="mono faint">{identity.data?.sshCommand || '(default)'}</span>
          {info.platform === 'win32' &&
            (identity.data?.sshCommand ? (
              <Button size="sm" onClick={() => void setSshCommand('')}>
                Reset
              </Button>
            ) : (
              <Button size="sm" onClick={() => void setSshCommand(WINDOWS_OPENSSH)}>
                Use Windows OpenSSH
              </Button>
            ))}
        </Row>
      </div>

      <div className="section-title">Command line</div>
      <CommandLineSection />

      <div className="section-title">Files</div>
      <div className="card settings-section">
        {(Object.entries(info.paths) as [string, string][]).map(([key, path]) => (
          <Row key={key} title={key} description={<span className="mono selectable">{path}</span>}>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              title="Show in folder"
              icon={<FolderOpen size={14} />}
              onClick={() => run('reveal', () => api.app.revealPath(path))}
            />
          </Row>
        ))}
      </div>

      <div className="section-title">About</div>
      <AboutSection focus={focusAbout} onFocused={() => setFocusAbout(false)} />
    </>
  );
}
