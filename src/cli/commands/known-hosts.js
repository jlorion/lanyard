'use strict';

/** known_hosts: list, rm, scan. */

const out = require('../utils/output');

const { c } = out;

function register(program, core) {
  const kh = program.command('known-hosts').alias('kh').description('inspect and edit ~/.ssh/known_hosts');

  kh
    .command('list [search]', { isDefault: true })
    .description('list entries (optionally filtered)')
    .action(out.action((search) => {
      const q = (search || '').toLowerCase();
      const list = core.knownHosts.list().filter((e) => !q || e.hostsField.toLowerCase().includes(q));
      out.emit(list, () => out.table(list, [
        { key: 'line', label: 'Line', format: (v) => c.dim(v) },
        { key: 'hosts', label: 'Hosts', format: (v, e) => (e.hashed ? c.dim('(hashed)') : v.join(', ')) },
        { key: 'type', label: 'Type' },
        { key: 'fingerprint', label: 'Fingerprint', format: (v) => c.dim(v) },
        { key: 'marker', label: '' },
      ]));
    }));

  kh
    .command('rm <host>')
    .description('forget all keys of a host (also hashed entries)')
    .option('-p, --port <port>', 'non-standard port')
    .action(out.action(async (host, o) => {
      const r = await core.knownHosts.removeHost(host, o.port);
      out.emit(r, () => (r.removed ? out.ok(`Removed ${host}`) : out.info(`${host} was not in known_hosts`)));
    }));

  kh
    .command('scan <host>')
    .description('fetch a server\'s host keys and show their fingerprints')
    .option('-p, --port <port>', 'port')
    .option('--trust', 'append the keys to known_hosts')
    .action(out.action(async (host, o) => {
      const keys = await core.knownHosts.scan(host, o.port);
      const result = o.trust ? core.knownHosts.trust(keys.map((k) => k.raw)) : null;
      out.emit({ keys, result }, () => {
        out.table(keys, [
          { key: 'type', label: 'Type' },
          { key: 'fingerprint', label: 'Fingerprint' },
        ]);
        if (result) out.ok(`${result.added} key(s) added to known_hosts`);
        else out.info(`Compare with the provider's published fingerprints, then re-run with --trust`);
      });
    }));
}

module.exports = { register };
