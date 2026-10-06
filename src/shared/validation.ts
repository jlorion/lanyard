/** Validation rules shared by the core (authoritative) and the UI (instant feedback). */

/** Deliberately loose: one @, a dot in the domain, no spaces (no-reply addresses pass). */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
