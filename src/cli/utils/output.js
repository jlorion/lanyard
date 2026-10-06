'use strict';

/** Terminal output helpers: colors, tables, JSON mode and error handling. */

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));

const c = {
  bold: paint('1'),
  dim: paint('2'),
  red: paint('31'),
  green: paint('32'),
  yellow: paint('33'),
  blue: paint('34'),
  magenta: paint('35'),
  cyan: paint('36'),
};

const ANSI = /\x1b\[[0-9;]*m/g;
const width = (s) => String(s).replace(ANSI, '').length;

let jsonMode = false;
function setJson(on) { jsonMode = !!on; }
function isJson() { return jsonMode; }

function print(...lines) {
  for (const l of lines) process.stdout.write(`${l}\n`);
}

function json(data) {
  print(JSON.stringify(data, null, 2));
}

/** Print `data` as JSON in --json mode, otherwise call `human(data)`. */
function emit(data, human) {
  if (jsonMode) json(data);
  else human(data);
}

/**
 * columns: [{ key, label, format? }]
 */
function table(rows, columns) {
  if (!rows.length) {
    print(c.dim('  (none)'));
    return;
  }
  const cells = rows.map((r) => columns.map((col) => {
    const v = col.format ? col.format(r[col.key], r) : r[col.key];
    return v == null ? '' : String(v);
  }));
  const widths = columns.map((col, i) => Math.max(width(col.label), ...cells.map((row) => width(row[i]))));
  const line = (vals) => vals.map((v, i) => v + ' '.repeat(widths[i] - width(v))).join('  ').trimEnd();
  print(c.dim(line(columns.map((col) => col.label.toUpperCase()))));
  for (const row of cells) print(line(row));
}

const ok = (msg) => print(`${c.green('✔')} ${msg}`);
const warn = (msg) => print(`${c.yellow('!')} ${msg}`);
const info = (msg) => print(`${c.cyan('›')} ${msg}`);

/** Wrap a command action so errors print cleanly and set the exit code. */
function action(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      if (jsonMode) process.stderr.write(JSON.stringify({ error: err.message, code: err.code }) + '\n');
      else process.stderr.write(`${c.red('✖')} ${err.message}\n`);
      process.exitCode = 1;
    }
  };
}

module.exports = { c, print, json, emit, table, ok, warn, info, action, setJson, isJson };
