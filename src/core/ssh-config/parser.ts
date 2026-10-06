/**
 * Lossless-ish ssh_config parser/serializer.
 *
 * Lines that are not touched by an edit are written back byte-for-byte, so
 * comments, ordering, blank lines and odd formatting survive round trips.
 */

import { BEGIN, END } from './managed-section';
import type { Block, ConfigModel, Directive, Line } from './model';

const DIRECTIVE_RE = /^(\s*)([A-Za-z][A-Za-z0-9]*)(?:\s*=\s*|\s+)(.*?)\s*$/;

export function parseLine(raw: string): Line {
  const trimmed = raw.trim();
  if (!trimmed) return { type: 'blank', raw };
  if (trimmed.startsWith('#')) return { type: 'comment', raw };
  const m = raw.match(DIRECTIVE_RE);
  if (!m) return { type: 'other', raw };
  return { type: 'directive', raw, indent: m[1], key: m[2], value: m[3] };
}

/** Parse a line that is known to be a directive (built by sshm itself). */
export function parseDirective(raw: string): Directive {
  const line = parseLine(raw);
  if (line.type !== 'directive') throw new Error(`Not a directive: ${raw}`);
  return line;
}

function isHeader(line: Line): line is Directive {
  return line.type === 'directive' && /^(host|match)$/i.test(line.key);
}

export function parseBlocks(lines: string[]): { preamble: Line[]; blocks: Block[] } {
  const preamble: Line[] = [];
  const blocks: Block[] = [];
  let current: Block | null = null;
  for (const raw of lines) {
    const line = parseLine(raw);
    if (isHeader(line)) {
      const prev: Line[] = current ? current.body : preamble;
      const leading: Line[] = [];
      while (prev.length && prev[prev.length - 1].type === 'comment') leading.unshift(prev.pop()!);
      current = { kind: line.key.toLowerCase() === 'host' ? 'Host' : 'Match', header: line, leading, body: [] };
      blocks.push(current);
    } else {
      (current ? current.body : preamble).push(line);
    }
  }
  return { preamble, blocks };
}

export function parse(text = ''): ConfigModel {
  text = text.replace(/^﻿/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  let lines = text.split(/\r?\n/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop();

  let managedLines: string[] = [];
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

export function serialize(model: ConfigModel): string {
  const out: string[] = [];
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
