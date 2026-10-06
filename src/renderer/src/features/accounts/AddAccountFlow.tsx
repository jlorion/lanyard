import { useState } from 'react';
import { api } from '../../lib/api';
import { useToast } from '../../components/feedback/ToastProvider';
import { PublicKeyModal } from '../../components/domain/PublicKeyModal';
import { AccountFormModal } from './AccountFormModal';
import type { AddAccountResult, ProviderOverview } from '../../../../shared/types';

/**
 * "Add account" as a self-contained flow, usable from any page: the account
 * form, then - when a key was generated - its public key with a link to the
 * provider's key settings and a Test button.
 */
export function AddAccountFlow({
  providers,
  initialProvider,
  onClose,
  onCreated,
}: {
  providers: ProviderOverview[];
  initialProvider?: string;
  onClose: () => void;
  onCreated?: (result: AddAccountResult) => void;
}) {
  const toast = useToast();
  const [created, setCreated] = useState<AddAccountResult | null>(null);

  if (created?.publicKey) {
    const provider = providers.find((p) => p.id === created.account.provider);
    return (
      <PublicKeyModal
        title={`Account "${created.account.name}" added`}
        publicKey={created.publicKey}
        keysUrl={created.keysUrl}
        providerName={provider?.name}
        hint={created.keyHint}
        onTest={() => api.accounts.test(created.account.provider, created.account.name)}
        onClose={onClose}
      />
    );
  }

  return (
    <AccountFormModal
      mode="create"
      providers={providers}
      initialProvider={initialProvider}
      onClose={onClose}
      onCreated={(result) => {
        onCreated?.(result);
        if (result.publicKey) setCreated(result);
        else {
          toast.success(`Added ${result.account.id}`);
          onClose();
        }
      }}
    />
  );
}
