'use strict';

/** Turns raw `ssh -T` output into a { ok, username, message, output } verdict. */
function interpretTest(provider, { code, stdout, stderr, timedOut }) {
  const out = `${stdout}\n${stderr}`.trim();
  const fail = (message) => ({ ok: false, message, output: out });

  if (timedOut) return fail('Connection timed out.');
  if (/Permission denied/i.test(out)) {
    return fail('Permission denied - the key is not registered with this account (or needs a passphrase).');
  }
  if (/Host key verification failed/i.test(out)) return fail('Host key verification failed - check known_hosts.');
  if (/Could not resolve hostname|Connection refused|Connection timed out|Network is unreachable/i.test(out)) {
    return fail('Could not reach the server.');
  }
  if (provider.failure && provider.failure.test(out)) {
    return fail('Connected, but the server did not recognise this key.');
  }
  if (provider.success.test(out)) {
    const m = provider.username ? out.match(provider.username) : null;
    const username = m ? m[1].trim() : '';
    return { ok: true, username, message: username ? `Authenticated as ${username}` : 'Authenticated', output: out };
  }
  return { ok: code === 0, message: code === 0 ? 'Connected' : `ssh exited with code ${code}`, output: out };
}

module.exports = { interpretTest };
