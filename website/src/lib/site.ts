export const REPO = 'riomar0001/lanyard';
export const GITHUB = `https://github.com/${REPO}`;
export const RELEASES = `${GITHUB}/releases`;

/** A site-relative path ("/docs/") with the deploy base ("/lanyard") in front. */
export function withBase(p: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${p.startsWith('/') ? p : `/${p}`}`;
}
