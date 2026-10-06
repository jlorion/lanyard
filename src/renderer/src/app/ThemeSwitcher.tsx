import { useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { applyTheme, storedTheme, type ThemeMode } from '../lib/theme';

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: 'system', label: 'System theme', icon: Monitor },
  { mode: 'light', label: 'Light theme', icon: Sun },
  { mode: 'dark', label: 'Dark theme', icon: Moon },
];

export function ThemeSwitcher() {
  const [mode, setMode] = useState<ThemeMode>(storedTheme);
  return (
    <div className="theme-switcher" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ mode: m, label, icon: Icon }) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          title={label}
          className={mode === m ? 'active' : ''}
          onClick={() => {
            setMode(m);
            applyTheme(m);
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
