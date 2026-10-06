/** Thin wrapper over the git CLI for identities and remotes. */

import fs from 'node:fs';
import path from 'node:path';
import { run } from '../utils/exec';
import type { GitIdentity } from '../../shared/types';

async function git(args: string[], cwd?: string) {
  const r = await run('git', args, { cwd });
  return { ...r, out: r.stdout.trim() };
}

export async function getGlobalIdentity(): Promise<GitIdentity> {
  try {
    const [name, email, sshCommand] = await Promise.all([
      git(['config', '--global', 'user.name']),
      git(['config', '--global', 'user.email']),
      git(['config', '--global', 'core.sshCommand']),
    ]);
    return { name: name.out, email: email.out, sshCommand: sshCommand.out };
  } catch {
    return { name: '', email: '', sshCommand: '' };
  }
}

export async function setGlobalIdentity({ name, email }: { name?: string; email?: string }): Promise<void> {
  if (name) await git(['config', '--global', 'user.name', name]);
  if (email) await git(['config', '--global', 'user.email', email]);
}

/** Set (or unset with an empty value) git's global core.sshCommand. */
export async function setSshCommand(command: string): Promise<void> {
  const args = command
    ? ['config', '--global', 'core.sshCommand', command]
    : ['config', '--global', '--unset', 'core.sshCommand'];
  const r = await git(args);
  if (r.code !== 0 && command) throw new Error(r.stderr.trim() || 'git config failed');
}

function assertRepo(dir: string): void {
  if (!dir || !fs.existsSync(path.join(dir, '.git'))) throw new Error(`Not a git repository: ${dir}`);
}

export async function getRemotes(dir: string): Promise<Record<string, string>> {
  assertRepo(dir);
  const r = await git(['remote', '-v'], dir);
  const remotes: Record<string, string> = {};
  for (const line of r.out.split(/\r?\n/)) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\(fetch\)$/);
    if (m) remotes[m[1]] = m[2];
  }
  return remotes;
}

export async function setRemoteUrl(dir: string, remote: string, url: string): Promise<void> {
  assertRepo(dir);
  const r = await git(['remote', 'set-url', remote, url], dir);
  if (r.code !== 0) throw new Error(r.stderr.trim() || 'git remote set-url failed');
}

export async function setLocalIdentity(dir: string, { name, email }: { name?: string; email?: string }): Promise<void> {
  assertRepo(dir);
  if (name) await git(['config', 'user.name', name], dir);
  if (email) await git(['config', 'user.email', email], dir);
}
