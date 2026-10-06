'use strict';

/** Structured, formatting-preserving edits on a parsed ssh_config model. */

const { parseLine, parseBlocks } = require('./parser');
const { formatValue } = require('./managed-section');

function detectIndent(model) {
  for (const block of model.blocks) {
    const d = block.body.find((l) => l.type === 'directive' && l.indent);
    if (d) return d.indent;
  }
  return '    ';
}

function makeDirective(key, value, indent = '') {
  return parseLine(`${indent}${key} ${formatValue(key, value)}`);
}

function commentLines(comment) {
  if (!comment) return [];
  return String(comment).split(/\r?\n/).map((c) => parseLine(`# ${c}`.trimEnd()));
}

function blockInfo(block, index, managed = false) {
  const patterns = block.header.value;
  const aliases = patterns.split(/\s+/).filter(Boolean);
  const options = block.body
    .filter((l) => l.type === 'directive')
    .map((l) => ({ key: l.key, value: l.value }));
  const get = (k) => {
    const o = options.find((x) => x.key.toLowerCase() === k.toLowerCase());
    return o ? o.value.replace(/^"|"$/g, '') : '';
  };
  return {
    index,
    managed,
    kind: block.kind,
    patterns,
    alias: aliases[0] || '',
    aliases,
    isPattern: block.kind === 'Match' || aliases.some((a) => /[*?!]/.test(a)),
    hostName: get('HostName'),
    user: get('User'),
    port: get('Port'),
    identityFile: get('IdentityFile'),
    options,
    comment: block.leading.map((l) => l.raw.trim().replace(/^#\s?/, '')).join('\n'),
  };
}

/** All Host/Match blocks: managed ones first (read-only), then the user's. */
function listHosts(model) {
  const managed = parseBlocks(model.managedLines).blocks
    .map((b, i) => blockInfo(b, i, true))
    .filter((h) => h.patterns !== '*'); // the scope-reset terminator is an implementation detail
  const user = model.blocks.map((b, i) => blockInfo(b, i, false));
  return [...managed, ...user];
}

function getBlock(model, index, expectedPatterns) {
  const block = model.blocks[index];
  if (!block || (expectedPatterns != null && block.header.value !== expectedPatterns)) {
    throw new Error('The SSH config changed on disk. Refresh and try again.');
  }
  return block;
}

function validatePatterns(patterns) {
  const p = String(patterns || '').trim();
  if (!p) throw new Error('Host alias is required.');
  if (/[\r\n#]/.test(p)) throw new Error('Host alias contains invalid characters.');
  return p;
}

/**
 * Update a block's directives in place: existing lines keep their position and
 * formatting where the key survives, removed keys are dropped, new keys are
 * appended after the last directive. Comment lines inside the body are kept.
 */
function applyOptions(block, options, indent) {
  const clean = options
    .filter((o) => o.key && String(o.key).trim())
    .map((o) => ({ key: String(o.key).trim(), value: String(o.value ?? '') }));
  const byKey = new Map();
  for (const o of clean) {
    const k = o.key.toLowerCase();
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(o);
  }
  const used = new Set();
  const body = [];
  for (const line of block.body) {
    if (line.type !== 'directive') { body.push(line); continue; }
    const o = (byKey.get(line.key.toLowerCase()) || []).find((x) => !used.has(x));
    if (!o) continue; // option was removed
    used.add(o);
    const v = formatValue(line.key, o.value);
    body.push(v === line.value ? line : parseLine(`${line.indent}${line.key} ${v}`));
  }
  let insertAt = body.length;
  while (insertAt > 0 && body[insertAt - 1].type === 'blank') insertAt--;
  const fresh = clean.filter((o) => !used.has(o)).map((o) => makeDirective(o.key, o.value, indent));
  body.splice(insertAt, 0, ...fresh);
  block.body = body;
}

function updateHost(model, index, expectedPatterns, { patterns, options, comment }) {
  const block = getBlock(model, index, expectedPatterns);
  if (patterns != null) {
    const p = validatePatterns(patterns);
    if (p !== block.header.value) block.header = parseLine(`${block.header.indent}${block.kind} ${p}`);
  }
  if (options) applyOptions(block, options, detectIndent(model));
  if (comment !== undefined) block.leading = commentLines(comment);
}

function addHost(model, { patterns, options = [], comment }) {
  const p = validatePatterns(patterns);
  const indent = detectIndent(model);
  const block = {
    kind: 'Host',
    header: parseLine(`Host ${p}`),
    leading: commentLines(comment),
    body: options
      .filter((o) => o.key && String(o.key).trim())
      .map((o) => makeDirective(String(o.key).trim(), o.value, indent)),
  };
  block.body.push(parseLine(''));

  // Keep a trailing catch-all "Host *" last so specific hosts still win.
  let at = model.blocks.length;
  const last = model.blocks[at - 1];
  if (last && last.kind === 'Host' && last.header.value.trim() === '*') at -= 1;

  // Separate from the previous block with a blank line for readability.
  const prev = at > 0 ? model.blocks[at - 1].body : model.preamble;
  if (prev.length && prev[prev.length - 1].type !== 'blank') prev.push(parseLine(''));

  model.blocks.splice(at, 0, block);
  return at;
}

function removeHost(model, index, expectedPatterns) {
  getBlock(model, index, expectedPatterns);
  model.blocks.splice(index, 1);
}

module.exports = { listHosts, updateHost, addHost, removeHost };
