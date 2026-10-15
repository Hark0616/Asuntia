import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, Folder, RefreshCw } from 'lucide-react';
import type { StorageItem } from '@/types/storage';
import { startStorageOperation, storageError, useStorageOperation } from '../api/storage';
import '../storage.css';

interface Props {
  connectionId: string;
  rootId?: string;
  asuntoId?: string;
  foldersOnly?: boolean;
  disabled?: boolean;
  onSelect: (item: StorageItem) => void;
}

export function OneDriveBrowser({connectionId, rootId = 'root', asuntoId, foldersOnly = false, disabled, onSelect}: Props) {
  const [path, setPath] = useState([{id: rootId, name: 'Carpeta inicial'}]);
  const [request, setRequest] = useState({id: crypto.randomUUID(), cursor: undefined as string | undefined});
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [previousItems, setPreviousItems] = useState<StorageItem[]>([]);
  const create = useMutation({mutationFn: startStorageOperation});
  const current = path[path.length - 1];
  const job = useStorageOperation(jobId);
  useEffect(() => {
    let active = true;
    setJobId(null);
    setError('');
    create.mutateAsync({operation_id: request.id, action: 'browse', connection_id: connectionId,
      asunto_id: asuntoId, item_id: current.id, cursor: request.cursor,
      for_binding: Boolean(foldersOnly && asuntoId)}).then((operation) => {
      if (active) setJobId(operation.id);
    }).catch((failure) => { if (active) setError(storageError(failure)); });
    return () => { active = false; };
  }, [connectionId, asuntoId, current.id, request.id, request.cursor]);
  const pending = create.isPending || !job.data || ['queued', 'running'].includes(job.data.status);
  const message = error || (job.isError ? storageError(job.error) : job.data?.error_message || '');
  const items = [...previousItems, ...(job.data?.status === 'completed' ? job.data.result?.items || [] : [])];
  const navigate = (next: typeof path) => {
    setPreviousItems([]);
    setPath(next);
    setRequest({id: crypto.randomUUID(), cursor: undefined});
  };

  return <section className="storage-browser" aria-label="Archivos de OneDrive">
    <div className="document-toolbar">
      <strong>{current.name}</strong>
      <div className="team-actions">
        {path.length > 1 && <button type="button" className="secondary-button" disabled={disabled}
          onClick={() => navigate(path.slice(0, -1))}>Subir un nivel</button>}
        <button type="button" className="secondary-button" disabled={disabled || (pending && !message)}
          onClick={() => { setPreviousItems([]); setRequest({id: crypto.randomUUID(), cursor: undefined}); }}>
          <RefreshCw size={16} aria-hidden="true" /> Actualizar carpeta
        </button>
      </div>
    </div>
    {message && <p role="alert" className="document-error">{message}</p>}
    {pending && !message && <p role="status">Consultando OneDrive…</p>}
    {!pending && !message && items.length === 0 && <p className="muted">Esta carpeta está vacía.</p>}
    <ul className="storage-items">
      {items.filter(item => !foldersOnly || item.folder).map((item) => <li key={item.id}>
        {item.folder ? <Folder size={18} aria-hidden="true" /> : <FileText size={18} aria-hidden="true" />}
        <button type="button" className="secondary-button" disabled={disabled}
          onClick={() => item.folder ? navigate([...path, {id: item.id, name: item.name}]) : onSelect(item)}>
          {item.name}
        </button>
      </li>)}
    </ul>
    {foldersOnly && !pending && !message && <button type="button" className="primary-button" disabled={disabled}
      onClick={() => onSelect({id: current.id, name: current.name, folder: true, size: 0})}>Usar esta carpeta</button>}
    {job.data?.status === 'completed' && job.data.result?.next_cursor && <button type="button" className="secondary-button"
      disabled={disabled} onClick={() => {
        setPreviousItems(items);
        setRequest({id: crypto.randomUUID(), cursor: job.data!.result!.next_cursor!});
      }}>Cargar más</button>}
  </section>;
}
