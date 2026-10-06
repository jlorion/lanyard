import { initials } from '../../lib/format';
import { PROVIDER_ICONS } from './provider-icons';

function luminance(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * Provider logo on a tile in the brand colour. Built-in providers get their
 * real mark; custom (self-hosted) providers fall back to a letter monogram.
 */
export function ProviderMark({ id, name, color, size = 34 }: { id?: string; name: string; color: string; size?: number }) {
  const icon = id ? PROVIDER_ICONS[id] : undefined;
  const background = icon ? `#${icon.hex}` : color;
  const lum = luminance(background);
  const foreground = lum > 0.65 ? '#111' : '#fff';
  // Near-black tiles (GitHub, SourceHut) need an outline to stay visible in dark mode.
  const ring = lum < 0.12 ? 'inset 0 0 0 1px rgba(255, 255, 255, 0.16)' : undefined;

  return (
    <span
      className="monogram"
      style={{ background, color: foreground, width: size, height: size, fontSize: size * 0.38, boxShadow: ring }}
      title={name}
      aria-hidden
    >
      {icon ? (
        <svg viewBox="0 0 24 24" width={Math.round(size * 0.58)} height={Math.round(size * 0.58)} fill="currentColor">
          <path d={icon.path} />
        </svg>
      ) : (
        initials(name)
      )}
    </span>
  );
}
