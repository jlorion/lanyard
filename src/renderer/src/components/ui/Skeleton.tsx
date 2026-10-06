/** Placeholder bars shown while data loads. */
export function Skeleton({ rows = 3, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div className="skeleton-list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  );
}
