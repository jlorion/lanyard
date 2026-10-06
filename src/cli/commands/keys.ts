/** SSH keys: list, gen, pub, passwd, rm, fix-perms. */

import * as out from '../utils/output';
import { interactive, copyToClipboard } from '../utils/system';
import type { CommandModule } from '../types';
import type { KeyType } from '../../shared/types';

const { c } = out;

export const register: CommandModule = (program, core) => {
  const keys = program.command('keys').alias('key').description('manage key pairs in ~/.ssh');

  keys
    .command('list', { isDefault: true })
    .description('list keys')
    .action(out.action(() => {
      const list = core.keys.list();
      out.emit(list, () => out.table(list, [
        { key: 'name', label: 'Name', format: (v) => c.bold(v) },
        { key: 'type', label: 'Type' },
        { key: 'fingerprint', label: 'Fingerprint', format: (v) => c.dim(v) },
        { key: 'comment', label: 'Comment' },
        { key: 'encrypted', label: 'Passphrase', format: (v) => (v ? 'yes' : '') },
        { key: 'hasPrivate', label: '', format: (v) => (v ? '' : c.yellow('public only')) },
      ]));
    }));

  keys
    .command('gen <name>')
    .alias('generate')
    .description('generate a new key pair in ~/.ssh')
    .option('-t, --type <type>', 'ed25519 | rsa | ecdsa', 'ed25519')
    .option('-b, --bits <bits>', 'key size (rsa / ecdsa)')
    .option('-C, --comment <comment>', 'key comment, usually your email', '')
    .option('-N, --passphrase <passphrase>', 'passphrase (empty for none)', '')
    .action(out.action(async (name: string, o: { type: KeyType; bits?: string; comment: string; passphrase: string }) => {
      const key = await core.keys.generate({ name, type: o.type, bits: o.bits, comment: o.comment, passphrase: o.passphrase });
      const publicKey = await core.keys.publicKey(key.path!);
      out.emit({ ...key, publicKey }, () => {
        out.ok(`Generated ${c.bold(key.tildePath)} (${key.type}, ${key.fingerprint})`);
        out.print('', publicKey);
      });
    }));

  keys
    .command('pub <key>')
    .description('print a public key')
    .option('--copy', 'copy it to the clipboard')
    .action(out.action(async (key: string, o: { copy?: boolean }) => {
      const pub = await core.keys.publicKey(key);
      if (!o.copy) return out.print(pub);
      if (!copyToClipboard(pub)) throw new Error('No clipboard tool found.');
      out.ok('Public key copied to clipboard');
    }));

  keys
    .command('passwd <key>')
    .description('change a key passphrase (interactive)')
    .action(out.action((key: string) => {
      process.exitCode = interactive('ssh-keygen', ['-p', '-f', core.keys.resolve(key)]);
    }));

  keys
    .command('rm <key>')
    .description('move a key pair to ~/.lanyard/trash')
    .action(out.action((key: string) => {
      const target = core.keys.resolve(key);
      const users = core.accounts.list().filter((a) => a.keyExists && core.keys.resolve(a.keyPath) === target);
      if (users.length) throw new Error(`Key is used by: ${users.map((a) => a.id).join(', ')}`);
      const r = core.keys.remove(key);
      out.emit(r, () => out.ok(`Moved to ${r.trashDir}`));
    }));

  keys
    .command('fix-perms <key>')
    .description('restrict a private key to the current user')
    .action(out.action(async (key: string) => {
      const r = await core.keys.fixPermissions(key);
      out.ok(r.message);
    }));
};
