'use strict';

/**
 * Lossless-ish ssh_config parser/serializer.
 *
 * Lines that are not touched by an edit are written back byte-for-byte, so
 * comments, ordering, blank lines and odd formatting survive round trips.
 *
 * A parsed model looks like:
 *   { eol, managedLines: string[], preamble: Line[], blocks: Block[] }
 * where Block = { kind: 'Host'|'Match', header: Line, leading: Line[], body: Line[] }
 * and `leading` holds the comment lines directly above the header.
 */

const { BEGIN, END } = require('./managed-section');

const DIRECTIVE_RE = /^(\s*)([A-Za-z][A-Za-z0-9]*)(?:\s*=\s*|\s+)(.*?)\s*$/;

function parseLine(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'blank', raw };
  if (trimmed.startsWith('#')) return { type: 'comment', raw };
  const m = raw.match(DIRECTIVE_RE);
  if (!m) return { type: 'other', raw };
  return { type: 'directive', raw, indent: m[1], key: m[2], value: m[3] };
}

function isHeader(line) {
  return line.type === 'directive' && /^(host|match)$/i.test(line.key);
}

function parseBlocks(lines) {
  const preamble = [];
  const blocks = [];
  let current = null;
  for (const raw of lines) {
    const line = parseLine(raw);
    if (isHeader(line)) {
      const prev = current ? current.body : preamble;
      const leading = [];
      while (prev.length && prev[prev.length - 1].type === 'comment') leading.unshift(prev.pop());
      current = {
        kind: line.key.toLowerCase() === 'host' ? 'Host' : 'Match',
        header: line,
        leading,
        body: [],
      };
      blocks.push(current);
    } else {
      (current ? current.body : preamble).push(line);
    }
  }
  return { preamble, blocks };
}

function parse(text = '') {
  text = text.replace(/^﻿/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let managedLines = [];
  const b = lines.findIndex((l) => l.trim() === BEGIN);
  if (b !== -1) {
    // A missing END marker means somebody mangled the section. Only the BEGIN
    // line is treated as managed so that no user content can be lost.
    let e = lines.findIndex((l, i) => i > b && l.trim() === END);
    if (e === -1) e = b;
    managedLines = lines.slice(b, e + 1);
    lines = [...lines.slice(0, b), ...lines.slice(e + 1)];
    // Drop the blank separator line sshm writes after the section.
    if (lines[b] !== undefined && lines[b].trim() === '') lines.splice(b, 1);
  }

  const { preamble, blocks } = parseBlocks(lines);
  return { eol, managedLines, preamble, blocks };
}

function serialize(model) {
  const out = [];
  if (model.managedLines.length) {
    out.push(...model.managedLines);
    if (model.preamble.length || model.blocks.length) out.push('');
  }
  out.push(...model.preamble.map((l) => l.raw));
  for (const block of model.blocks) {
    out.push(...block.leading.map((l) => l.raw));
    out.push(block.header.raw);
    out.push(...block.body.map((l) => l.raw));
  }
  return out.length ? out.join(model.eol) + model.eol : '';
}

module.exports = { parseLine, parseBlocks, parse, serialize };
