/**
 * Edit PATH-style lists ("C:\a;C:\b" or "/a:/b") without disturbing other
 * entries. Comparison ignores surrounding quotes and trailing slashes, and is
 * case-insensitive on Windows.
 */

export interface PathListOptions {
  /** ';' on Windows, ':' elsewhere. */
  separator: string;
  caseInsensitive: boolean;
}

export const NATIVE_PATH_LIST: PathListOptions = {
  separator: process.platform === 'win32' ? ';' : ':',
  caseInsensitive: process.platform === 'win32',
};

function normalize(entry: string, opts: PathListOptions): string {
  const e = entry
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/[\\/]+$/, '');
  return opts.caseInsensitive ? e.toLowerCase() : e;
}

function entries(list: string, opts: PathListOptions): string[] {
  return list.split(opts.separator).filter((e) => e.trim() !== '');
}

export function pathListHas(list: string, dir: string, opts: PathListOptions = NATIVE_PATH_LIST): boolean {
  const target = normalize(dir, opts);
  return entries(list, opts).some((e) => normalize(e, opts) === target);
}

/** Append `dir` unless it is already present. Other entries are kept verbatim. */
export function addToPathList(list: string, dir: string, opts: PathListOptions = NATIVE_PATH_LIST): string {
  if (pathListHas(list, dir, opts)) return list;
  return [...entries(list, opts), dir].join(opts.separator);
}

/** Remove every spelling of `dir`. Other entries are kept verbatim. */
export function removeFromPathList(list: string, dir: string, opts: PathListOptions = NATIVE_PATH_LIST): string {
  const target = normalize(dir, opts);
  return entries(list, opts)
    .filter((e) => normalize(e, opts) !== target)
    .join(opts.separator);
}
