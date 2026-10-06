export function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

/** "SHA256:abcdefghijklmnop..." -> "SHA256:abcdefgh…mnop" */
export function shortFingerprint(fp: string): string {
  if (fp.length <= 28) return fp;
  return `${fp.slice(0, 18)}…${fp.slice(-6)}`;
}

/** "GitHub" -> "GH", "Hugging Face" -> "HF", "Bitbucket" -> "B". */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  const capitals = name.match(/[A-Z]/g) ?? [];
  return (capitals.length > 1 ? capitals.slice(0, 2).join('') : name.charAt(0)).toUpperCase();
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`;
}
