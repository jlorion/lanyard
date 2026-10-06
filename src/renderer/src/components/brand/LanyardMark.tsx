import { useId } from 'react';

/**
 * The Lanyard logo as inline SVG. Same geometry as scripts/make-icons.mjs
 * (coordinates are in the reference artwork's pixel space), so the in-app mark
 * matches the app and tray icons exactly. Cut-outs are painted with the tile
 * gradient, which is defined in user space so they line up seamlessly.
 */
export function LanyardMark({ size = 32 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  const tile = `url(#lanyard-tile-${uid})`;
  return (
    <svg width={size} height={size} viewBox="266.5 101 490 490" aria-hidden>
      <defs>
        <linearGradient id={`lanyard-tile-${uid}`} gradientUnits="userSpaceOnUse" x1="0" y1="101" x2="0" y2="591">
          <stop offset="0" stopColor="#2f343e" />
          <stop offset="1" stopColor="#181a20" />
        </linearGradient>
        <clipPath id={`lanyard-clip-${uid}`}>
          <rect x="286.1" y="120.6" width="450.8" height="450.8" rx="88" />
        </clipPath>
      </defs>
      <rect x="286.1" y="120.6" width="450.8" height="450.8" rx="88" fill={tile} />
      <g clipPath={`url(#lanyard-clip-${uid})`}>
        {/* left strap, then a tile-coloured gap where it passes under the right strap */}
        <polygon points="365.3,-50 411.3,-50 537.2,270 491.2,270" fill="#fff" />
        <line x1="611.5" y1="-50" x2="490" y2="262" stroke={tile} strokeWidth="14" />
        <polygon points="611.5,-50 657.5,-50 532.9,270 486.9,270" fill="#fff" />
        {/* clip ring */}
        <rect x="480" y="262" width="63" height="29" rx="10" fill="#fff" />
        <rect x="487" y="269" width="49" height="15" rx="4" fill={tile} />
        {/* card with its slot, the connector on top, and the >_ cut-out */}
        <rect x="435" y="316" width="153" height="216" rx="18" fill="#fff" />
        <rect x="493" y="312" width="37" height="24" rx="3" fill={tile} />
        <rect x="485" y="334" width="53" height="13" rx="3" fill={tile} />
        <rect x="504" y="288" width="15" height="12" fill="#fff" />
        <rect x="500" y="296" width="23" height="50" rx="3" fill="#fff" />
        <circle cx="512" cy="311" r="4.5" fill={tile} />
        <polyline
          points="472,398 500,427 472,457"
          fill="none"
          stroke={tile}
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="511" y="458" width="48" height="10" rx="2" fill={tile} />
      </g>
    </svg>
  );
}
