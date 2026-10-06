import { useState } from 'react';
import { Activity, Copy, ExternalLink, KeyRound } from 'lucide-react';
import { api } from '../../lib/api';
import { useTask } from '../../hooks/useTask';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Callout, CodeBlock } from '../ui/Feedback';
import type { TestResult } from '../../../../shared/types';

/** Shows a public key with copy / "open provider settings" / test actions. */
export function PublicKeyModal({
  title,
  publicKey,
  keysUrl,
  providerName,
  hint,
  onTest,
  onClose,
}: {
  title: string;
  publicKey: string;
  keysUrl?: string;
  providerName?: string;
  hint?: string;
  onTest?: () => Promise<TestResult>;
  onClose: () => void;
}) {
  const { run, isBusy } = useTask();
  const [result, setResult] = useState<TestResult | null>(null);

  const test = async () => {
    if (!onTest) return;
    const r = await run('test', onTest);
    if (r) setResult(r);
  };

  return (
    <Modal
      title={title}
      icon={<KeyRound size={18} />}
      onClose={onClose}
      wide
      footer={
        <>
          {onTest && (
            <Button icon={<Activity size={15} />} loading={isBusy('test')} onClick={test}>
              Test connection
            </Button>
          )}
          <span className="spacer" />
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          {providerName ? (
            <>
              Register this public key with your <b>{providerName}</b> account, then test the connection.
            </>
          ) : (
            'Copy this public key to the server or service that should accept it.'
          )}
        </p>
        <CodeBlock>{publicKey}</CodeBlock>
        <div className="row">
          <Button
            variant="primary"
            icon={<Copy size={15} />}
            onClick={() => run('copy', () => api.app.copy(publicKey), 'Public key copied')}
          >
            Copy public key
          </Button>
          {keysUrl && (
            <Button icon={<ExternalLink size={15} />} onClick={() => run('open', () => api.app.openExternal(keysUrl))}>
              Open {providerName ?? 'provider'} key settings
            </Button>
          )}
        </div>
        {hint && <Callout tone="warning">{hint}</Callout>}
        {result && (
          <Callout tone={result.ok ? 'success' : 'danger'}>
            {result.message}
            {result.hint && <div>{result.hint}</div>}
          </Callout>
        )}
      </div>
    </Modal>
  );
}
