import { useId } from 'react';

/** The Lanyard logo (same artwork as resources/icon.png) as crisp inline SVG. */
export function LanyardMark({ size = 32 }: { size?: number }) {
  const id = useId();
  const fill = `url(#${CSS.escape(id)})`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#9333ea" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="92" height="92" rx="18" fill={fill} />
      <g fill="#fff" stroke="#fff" strokeLinecap="round">
        <path d="M26 8 L46.5 42 M74 8 L53.5 42" strokeWidth="8" fill="none" />
        <rect x="43" y="41" width="14" height="12" rx="2" stroke="none" />
        <rect x="28" y="51.5" width="44" height="35" rx="5" stroke="none" />
      </g>
      <g fill={fill}>
        <rect x="44" y="55.9" width="12" height="3.2" rx="1.6" />
        <circle cx="40.5" cy="71" r="6" />
        <rect x="53" y="66.7" width="12" height="3.6" rx="1.8" />
        <rect x="53" y="72.7" width="8" height="3.6" rx="1.8" />
      </g>
    </svg>
  );
}
