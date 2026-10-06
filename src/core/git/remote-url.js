'use strict';

/**
 * Parse git remote URLs and rewrite them to use an SSH host alias, e.g.
 *   https://github.com/acme/app.git  ->  git@github.com-work:acme/app.git
 */

function parseRemote(url) {
  const u = String(url || '').trim();
  let m = u.match(/^(?:([\w.-]+)@)?([\w.-]+):(?!\/\/)(.+)$/); // scp-like: git@host:path
  if (m) return { user: m[1] || '', host: m[2], port: '', path: m[3] };
  m = u.match(/^ssh:\/\/(?:([\w.-]+)@)?([\w.-]+)(?::(\d+))?\/(.+)$/);
  if (m) return { user: m[1] || '', host: m[2], port: m[3] || '', path: m[4] };
  m = u.match(/^https?:\/\/(?:[^@/]+@)?([\w.-]+)(?::\d+)?\/(.+)$/);
  if (m) return { user: '', host: m[1], port: '', path: m[2] };
  return null;
}

function normalizePath(p) {
  let out = p.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!out.endsWith('.git')) out += '.git';
  return out;
}

/** Rewrite a remote to "<user>@<alias>:<path>". Port/HostName come from the alias. */
function toAliasUrl(url, alias, user = 'git') {
  const r = parseRemote(url);
  if (!r) throw new Error(`Unrecognised git URL: ${url}`);
  // Azure DevOps https URLs embed "_git"; its SSH form is v3/<org>/<project>/<repo>.
  let p = r.path;
  const azure = p.match(/^([^/]+)\/([^/]+)\/_git\/([^/]+)$/);
  if (azure) p = `v3/${azure[1]}/${azure[2]}/${azure[3]}`;
  return `${user}@${alias}:${azure ? p : normalizePath(p)}`;
}

module.exports = { parseRemote, toAliasUrl };
