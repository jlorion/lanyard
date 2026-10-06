/** In-memory representation of a parsed ssh_config file. */

export type Line =
  | { type: 'blank'; raw: string }
  | { type: 'comment'; raw: string }
  | { type: 'other'; raw: string }
  | { type: 'directive'; raw: string; indent: string; key: string; value: string };

export type Directive = Extract<Line, { type: 'directive' }>;

export interface Block {
  kind: 'Host' | 'Match';
  header: Directive;
  /** Comment lines directly above the header (no blank line in between). */
  leading: Line[];
  body: Line[];
}

export interface ConfigModel {
  eol: '\n' | '\r\n';
  /** Raw lines of the sshm managed section (empty when absent). */
  managedLines: string[];
  /** Global directives before the first Host/Match block. */
  preamble: Line[];
  blocks: Block[];
}

export interface ManagedEntry {
  comment: string;
  patterns: string;
  options: { key: string; value: string }[];
}
