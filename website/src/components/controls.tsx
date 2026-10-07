import { setTheme, useCopy, useTheme, type ThemeMode } from '../lib/hooks';
import { Icon, type IconName } from './icons';

/** Copy-to-clipboard button; with a label it shows "Copied" for a moment. */
export function CopyButton({
  text,
  label,
  icon = true,
  aria,
  className,
}: {
  text: string;
  label?: string;
  icon?: boolean;
  aria?: string;
  className?: string;
}) {
  const [copied, copy] = useCopy();
  return (
    <button
      type="button"
      className={`copy-btn${className ? ` ${className}` : ''}`}
      aria-label={aria ?? `Copy: ${text}`}
      title={label ? undefined : 'Copy'}
      onClick={() => copy(text)}
    >
      {icon && (
        <Icon name={copied ? 'check' : 'copy'} size={14} strokeWidth={copied ? 2.4 : 2} className={copied ? 'icon-ok' : undefined} />
      )}
      {label !== undefined && <span>{copied ? 'Copied' : label}</span>}
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}

const MODES: { mode: ThemeMode; label: string; icon: IconName }[] = [
  { mode: 'system', label: 'System', icon: 'monitor' },
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
];

/** System / Light / Dark. `large` shows words instead of icons (mobile menu). */
export function ThemeToggle({ large = false }: { large?: boolean }) {
  const current = useTheme();
  return (
    <div role="group" aria-label="Theme" className={`theme-toggle${large ? ' is-large' : ''}`}>
      {MODES.map((m) => (
        <button
          key={m.mode}
          type="button"
          aria-pressed={current === m.mode}
          aria-label={large ? undefined : `Use ${m.label.toLowerCase()} theme`}
          title={large ? undefined : m.label}
          onClick={() => setTheme(m.mode)}
        >
          {large ? m.label : <Icon name={m.icon} size={15} />}
        </button>
      ))}
    </div>
  );
}
