/** Terminal output helpers: colors, tables, JSON mode and error handling. */

const useColor = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: string) => (s: unknown) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

export const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  magenta: paint('35'),
  cyan: paint('36'),
};

const ANSI = /\x1b\[[0-9;]*m/g;
const width = (s: string) => s.replace(ANSI, '').length;

let jsonMode = false;
export function setJson(on: boolean): void {
  jsonMode = on;
}

export function print(...lines: string[]): void {
  for (const l of lines) process.stdout.write(`${l}\n`);
}

/** Print `data` as JSON in --json mode, otherwise call `human(data)`. */
export function emit<T>(data: T, human: (data: T) => void): void {
  if (jsonMode) print(JSON.stringify(data, null, 2));
  else human(data);
}

export interface Column<T> {
  key: keyof T & string;
  label: string;
  format?: (value: any, row: T) => unknown;
}

export function table<T>(rows: T[], columns: Column<T>[]): void {
  if (!rows.length) {
    print(c.dim('  (none)'));
    return;
  }
  const cells = rows.map((r) => columns.map((col) => {
    const raw = r[col.key];
    const v = col.format ? col.format(raw, r) : raw;
    return v == null ? '' : String(v);
  }));
  const widths = columns.map((col, i) => Math.max(width(col.label), ...cells.map((row) => width(row[i]))));
  const line = (vals: string[]) => vals.map((v, i) => v + ' '.repeat(widths[i] - width(v))).join('  ').trimEnd();
  print(c.dim(line(columns.map((col) => col.label.toUpperCase()))));
  for (const row of cells) print(line(row));
}

export const ok = (msg: string) => print(`${c.green('✔')} ${msg}`);
export const warn = (msg: string) => print(`${c.yellow('!')} ${msg}`);
export const info = (msg: string) => print(`${c.cyan('›')} ${msg}`);

/** Wrap a command action so errors print cleanly and set the exit code. */
export function action<A extends unknown[]>(fn: (...args: A) => unknown) {
  return async (...args: A): Promise<void> => {
    try {
      await fn(...args);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (jsonMode) process.stderr.write(JSON.stringify({ error: e.message, code: e.code }) + '\n');
      else process.stderr.write(`${c.red('✖')} ${e.message}\n`);
      process.exitCode = 1;
    }
  };
}
