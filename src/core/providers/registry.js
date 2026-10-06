'use strict';

/**
 * Built-in git hosting providers.
 *
 * hosts:     names matched by the "active account" block (first is primary).
 * success:   regex on `ssh -T` output that means the key was accepted.
 * username:  regex whose first group is the authenticated user, if printed.
 * failure:   regex that means the server answered but did not know the key.
 */
const BUILTIN_PROVIDERS = [
  {
    id: 'github',
    name: 'GitHub',
    hosts: ['github.com'],
    user: 'git',
    color: '#8b949e',
    keysUrl: 'https://github.com/settings/ssh/new',
    success: /successfully authenticated/i,
    username: /Hi ([^!]+)!/,
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    hosts: ['gitlab.com'],
    user: 'git',
    color: '#fc6d26',
    keysUrl: 'https://gitlab.com/-/user_settings/ssh_keys',
    success: /Welcome to GitLab/i,
    username: /Welcome to GitLab, @([^!]+)!/,
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    hosts: ['bitbucket.org'],
    user: 'git',
    color: '#2684ff',
    keysUrl: 'https://bitbucket.org/account/settings/ssh-keys/',
    success: /authenticated via ssh key|logged in as/i,
    username: /logged in as ([^.\s]+)/,
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    hosts: ['hf.co', 'huggingface.co'],
    user: 'git',
    color: '#ffb000',
    keysUrl: 'https://huggingface.co/settings/keys',
    success: /welcome to Hugging Face/i,
    username: /Hi ([^,\s]+), welcome/i,
    // HF greets unknown keys as "anonymous" instead of refusing them.
    failure: /Hi anonymous/i,
  },
  {
    id: 'azure',
    name: 'Azure DevOps',
    hosts: ['ssh.dev.azure.com'],
    user: 'git',
    color: '#0078d4',
    keysUrl: 'https://dev.azure.com/',
    keyHint: 'Azure DevOps has historically required RSA keys - generate an RSA key if ed25519 is rejected.',
    success: /Shell access is not supported/i,
    username: null,
  },
  {
    id: 'codeberg',
    name: 'Codeberg',
    hosts: ['codeberg.org'],
    user: 'git',
    color: '#2185d0',
    keysUrl: 'https://codeberg.org/user/settings/keys',
    success: /successfully authenticated/i,
    username: /Hi there, ([^!]+)!/,
  },
  {
    id: 'gitea',
    name: 'Gitea',
    hosts: ['gitea.com'],
    user: 'git',
    color: '#609926',
    keysUrl: 'https://gitea.com/user/settings/keys',
    success: /successfully authenticated/i,
    username: /Hi there, ([^!]+)!/,
  },
  {
    id: 'sourcehut',
    name: 'SourceHut',
    hosts: ['git.sr.ht'],
    user: 'git',
    color: '#d0d0d0',
    keysUrl: 'https://meta.sr.ht/keys',
    success: /successfully authenticated/i,
    username: /Hi ~?([^!]+)!/,
  },
];

const GENERIC_SUCCESS = /successfully authenticated|welcome to|logged in as|shell access is (disabled|not supported)/i;

/** Custom providers (self-hosted GitLab, Gitea, ...) come from state.json. */
function normalizeCustom(p) {
  return {
    id: p.id,
    name: p.name || p.id,
    hosts: (p.hosts && p.hosts.length ? p.hosts : [p.hostname]).filter(Boolean),
    hostname: p.hostname || (p.hosts && p.hosts[0]),
    port: p.port ? String(p.port) : '',
    user: p.user || 'git',
    color: p.color || '#a78bfa',
    keysUrl: p.keysUrl || '',
    custom: true,
    success: GENERIC_SUCCESS,
    username: /(?:Hi(?: there,)?|Welcome to [^,]+,)\s+@?([^!,\s]+)/i,
  };
}

function allProviders(state) {
  return [...BUILTIN_PROVIDERS, ...(state.customProviders || []).map(normalizeCustom)];
}

function getProvider(state, id) {
  const p = allProviders(state).find((x) => x.id === id);
  if (!p) throw new Error(`Unknown provider "${id}". Run \`sshm providers\` to list them.`);
  return p;
}

function primaryHost(p) {
  return p.hostname || p.hosts[0];
}

/** Host alias used for a specific account, e.g. "github.com-work". */
function aliasFor(p, accountName) {
  return `${primaryHost(p)}-${accountName}`;
}

module.exports = {
  BUILTIN_PROVIDERS,
  allProviders,
  getProvider,
  primaryHost,
  aliasFor,
  normalizeCustom,
};
