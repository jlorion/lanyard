import { Monitor, Moon, Sun } from 'lucide-react';
import { useAppearance } from './appearance';
import type { ThemeMode } from '../lib/appearance';

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'system', label: 'System theme', icon: Monitor },
  { mode: 'light', label: 'Light theme', icon: Sun },
  { mode: 'dark', label: 'Dark theme', icon: Moon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useAppearance();
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={theme === mode}
          title={label}
          className={theme === mode ? 'active' : ''}
          onClick={() => setTheme(mode)}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
