import { FolderOpen } from 'lucide-react';
import { api } from '../../lib/api';
import { useResource } from '../../hooks/useResource';
import { Button } from '../ui/Button';
import { Select } from '../ui/Field';

/** Pick a private key from ~/.ssh, or browse for one elsewhere. Value is a path. */
export function KeySelect({ value, onChange, allowEmpty }: { value: string; onChange: (path: string) => void; allowEmpty?: boolean }) {
  const { data: keys = [] } = useResource(() => api.keys.list(), ['keys']);
  const usable = keys.filter((k) => k.hasPrivate);
  const known = usable.some((k) => k.tildePath === value);

  const browse = async () => {
    const file = await api.app.pickFile();
    if (file) onChange(file);
  };

  return (
    <div className="row">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {(allowEmpty || !value) && <option value="">{allowEmpty ? '(none)' : 'Choose a key…'}</option>}
        {value && !known && <option value={value}>{value}</option>}
        {usable.map((k) => (
          <option key={k.tildePath} value={k.tildePath}>
            {k.name} · {k.type}
            {k.encrypted ? ' · passphrase' : ''}
            {k.comment ? ` · ${k.comment}` : ''}
          </option>
        ))}
      </Select>
      <Button iconOnly title="Browse for a key file" icon={<FolderOpen size={15} />} onClick={browse} />
    </div>
  );
}
