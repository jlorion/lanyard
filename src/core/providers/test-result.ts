import type { RunResult } from '../utils/exec';
import type { TestResult } from '../../shared/types';
import type { Provider } from './registry';

/** Turn raw `ssh -T` output into an ok / username / message verdict. */
export function interpretTest(provider: Provider, { code, stdout, stderr, timedOut }: RunResult): TestResult {
  const output = `${stdout}\n${stderr}`.trim();
  const fail = (message: string): TestResult => ({ ok: false, message, output });

  if (timedOut) return fail('Connection timed out.');
  if (/Permission denied/i.test(output)) {
    return fail('Permission denied - the key is not registered with this account (or needs a passphrase).');
  }
  if (/Host key verification failed/i.test(output)) return fail('Host key verification failed - check known_hosts.');
  if (/Could not resolve hostname|Connection refused|Connection timed out|Network is unreachable/i.test(output)) {
    return fail('Could not reach the server.');
  }
  if (provider.failure?.test(output)) return fail('Connected, but the server did not recognise this key.');
  if (provider.success.test(output)) {
    const m = provider.username ? output.match(provider.username) : null;
    const username = m ? m[1].trim() : '';
    return { ok: true, username, message: username ? `Authenticated as ${username}` : 'Authenticated', output };
  }
  return { ok: code === 0, message: code === 0 ? 'Connected' : `ssh exited with code ${code}`, output };
}
