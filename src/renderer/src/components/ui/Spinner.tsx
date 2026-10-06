/**
 * Indeterminate spinner: a faint track with an arc that grows and shrinks
 * while it rotates. Colour comes from `currentColor`.
 */
export function Spinner({ size = 16, label = 'Loading' }: { size?: number; label?: string }) {
  return (
    <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" role="status" aria-label={label}>
      <circle className="spinner-track" cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" />
      <circle className="spinner-arc" cx="12" cy="12" r="9" fill="none" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
