import { initials } from '../../lib/format';

/** Readable foreground for a hex background. */
function contrastText(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.65 ? '#111' : '#fff';
}

export function ProviderMark({ name, color, size = 34 }: { name: string; color: string; size?: number }) {
  return (
    <span
      className="monogram"
      style={{ background: color, color: contrastText(color), width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
