/** Page identifiers, kept free of component imports so any module can use them. */

export const PAGE_IDS = ['overview', 'accounts', 'hosts', 'keys', 'agent', 'known-hosts', 'backups', 'settings'] as const;

export type PageId = (typeof PAGE_IDS)[number];

export function isPageId(value: string): value is PageId {
  return (PAGE_IDS as readonly string[]).includes(value);
}
