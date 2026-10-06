import { Check } from 'lucide-react';
import { ACCENTS, type AccentId } from '../../lib/appearance';

/** Row of colour swatches; the selected one carries a check mark. */
export function AccentPicker({ value, onChange }: { value: AccentId; onChange: (accent: AccentId) => void }) {
  return (
    <div className="accent-picker" role="radiogroup" aria-label="Accent colour">
      {ACCENTS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          aria-label={a.label}
          title={a.label}
          className={`accent-swatch${value === a.id ? ' selected' : ''}`}
          style={{ ['--swatch' as string]: a.swatch }}
          onClick={() => onChange(a.id)}
        >
          {value === a.id && <Check size={14} strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
