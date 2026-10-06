import { useState } from 'react';
import { ArrowRight, Copy, FolderGit2, FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, RequiredMark } from '../../components/ui/Field';
import { Callout, CodeBlock } from '../../components/ui/Feedback';
import type { AccountView, RepoRewriteResult } from '../../../../shared/types';

/** Use a specific account for a clone URL or an existing local repository. */
export function RepoModal({ account, onClose }: { account: AccountView; onClose: () => void }) {
  const { run, isBusy } = useTask();
  const [repoUrl, setRepoUrl] = useState('');
  const [aliasUrl, setAliasUrl] = useState('');
  const [dir, setDir] = useState('');
  const [remote, setRemote] = useState('origin');
  const [setIdentity, setSetIdentity] = useState(true);
  const [applied, setApplied] = useState<RepoRewriteResult | null>(null);

  const convert = async () => {
    const url = await run('convert', () => api.accounts.cloneUrl(account.provider, account.name, repoUrl));
    if (url) setAliasUrl(url);
  };

  const browse = async () => {
    const picked = await api.app.pickDirectory();
    if (picked) setDir(picked);
  };

  const apply = async () => {
    const r = await run('apply', () => api.accounts.applyToRepo(account.provider, account.name, dir, { remote, setIdentity }), 'Repository updated');
    if (r) setApplied(r);
  };

  return (
    <Modal
      title={`Use "${account.name}" for a repository`}
      icon={<FolderGit2 size={18} />}
      onClose={onClose}
      wide
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="stack" style={{ gap: 18 }}>
        <section className="stack">
          <h3 style={{ fontSize: 14 }}>Clone with this account</h3>
          <div className="field">
            <span className="field-label">Repository URL<RequiredMark /></span>
            <div className="row">
              <Input mono aria-required value={repoUrl} placeholder="https://github.com/acme/app or git@github.com:acme/app.git" onChange={(e) => setRepoUrl(e.target.value)} />
              <Button icon={<ArrowRight size={15} />} disabled={!repoUrl} loading={isBusy('convert')} onClick={convert}>Convert</Button>
            </div>
          </div>
          {aliasUrl && (
            <>
              <CodeBlock>git clone {aliasUrl}</CodeBlock>
              <div className="row">
                <Button size="sm" icon={<Copy size={14} />} onClick={() => run('c1', () => api.app.copy(`git clone ${aliasUrl}`), 'Copied')}>Copy command</Button>
                <Button size="sm" icon={<Copy size={14} />} onClick={() => run('c2', () => api.app.copy(aliasUrl), 'Copied')}>Copy URL</Button>
              </div>
            </>
          )}
        </section>

        <section className="stack">
          <h3 style={{ fontSize: 14 }}>Switch an existing repository</h3>
          <p className="muted">Rewrites the remote to <code>{account.alias}</code> so this repo always uses this account, regardless of which one is active.</p>
          <div className="form-grid">
            <Field label="Repository folder" required className="full">
              <div className="row">
                <Input mono value={dir} placeholder="C:\code\my-repo" onChange={(e) => setDir(e.target.value)} />
                <Button iconOnly title="Browse" icon={<FolderOpen size={15} />} onClick={browse} />
              </div>
            </Field>
            <Field label="Remote" required>
              <Input mono value={remote} onChange={(e) => setRemote(e.target.value)} />
            </Field>
            <div className="field" style={{ justifyContent: 'flex-end' }}>
              <Checkbox checked={setIdentity} onChange={setSetIdentity} label="Set repo user.name / user.email" />
            </div>
          </div>
          <div className="row">
            <Button variant="primary" disabled={!dir || !remote} loading={isBusy('apply')} onClick={apply}>Apply to repository</Button>
          </div>
          {applied && (
            <Callout tone="success">
              {applied.remote}: <code>{applied.from}</code> → <code>{applied.to}</code>
            </Callout>
          )}
        </section>
      </div>
    </Modal>
  );
}
