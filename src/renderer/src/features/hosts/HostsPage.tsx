import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Segmented } from '../../components/ui/Field';
import { PageHeader } from '../../components/ui/Feedback';
import { SearchInput } from '../../components/ui/SearchInput';
import { useIntent } from '../../app/navigation';
import { HostEditorModal } from './HostEditorModal';
import { RawConfigEditor } from './RawConfigEditor';
import { HostsTable } from './HostsTable';

export function HostsPage() {
  const [view, setView] = useState<'list' | 'raw'>('list');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  useIntent('add-host', () => { setView('list'); setAdding(true); });
  useIntent('raw-config', () => setView('raw'));

  return (
    <>
      <PageHeader
        title="Hosts"
        description="Every Host entry in ~/.ssh/config. Edits keep your comments and formatting, and every change is backed up."
        actions={(
          <>
            <Segmented value={view} onChange={setView} options={[{ value: 'list', label: 'Hosts' }, { value: 'raw', label: 'Raw config' }]} />
            {view === 'list' && <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAdding(true)}>Add host</Button>}
          </>
        )}
      />

      {view === 'raw' ? <RawConfigEditor /> : (
        <>
          <div className="toolbar">
            <SearchInput value={query} onChange={setQuery} placeholder="Search hosts…" />
          </div>
          <HostsTable query={query} onAddServer={() => setAdding(true)} />
        </>
      )}

      {adding && <HostEditorModal host={null} onClose={() => setAdding(false)} />}
    </>
  );
}
