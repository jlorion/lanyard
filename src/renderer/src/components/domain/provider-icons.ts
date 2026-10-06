/**
 * Brand marks for the built-in providers, from Simple Icons (CC0; the marks
 * themselves remain trademarks of their owners). Simple Icons ships no
 * Microsoft logos, so Azure DevOps uses a neutral cloud glyph instead.
 */

import { siBitbucket, siCodeberg, siGitea, siGithub, siGitlab, siHuggingface, siSourcehut } from 'simple-icons';

export interface ProviderIcon {
  /** SVG path in a 24x24 viewBox. */
  path: string;
  /** Brand colour used for the tile, without '#'. */
  hex: string;
}

/** Lucide "cloud" outline, filled, as a 24x24 path. */
const CLOUD = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z';

export const PROVIDER_ICONS: Record<string, ProviderIcon> = {
  github: siGithub,
  gitlab: siGitlab,
  bitbucket: siBitbucket,
  huggingface: siHuggingface,
  codeberg: siCodeberg,
  gitea: siGitea,
  sourcehut: siSourcehut,
  azure: { path: CLOUD, hex: '0078D4' },
};
