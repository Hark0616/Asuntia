import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { startStorageOperation, storageError, useStorageOperation } from '@/features/firma/api/storage';

export function OneDriveAccess({id, canRefresh, onRefresh, onPreview}: {
  id: string; canRefresh: boolean; onRefresh: () => void;
  onPreview: (url: string, button: HTMLButtonElement) => void;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const consumed = useRef<string | null>(null);
  const create = useMutation({mutationFn: startStorageOperation, onSuccess: operation => setJobId(operation.id)});
  const job = useStorageOperation(jobId);
  const busy = create.isPending || ['queued', 'running'].includes(job.data?.status || '');
  useEffect(() => {
    if (job.data?.kind === 'refresh' && job.data.status === 'completed' && consumed.current !== job.data.id) {
      consumed.current = job.data.id;
      onRefresh();
    }
  }, [job.data]);
  const result = job.data?.kind === 'download' && job.data.status === 'completed' ? job.data.result : null;
  const url = result?.content_url ? apiClient.getUri({url: result.content_url.replace(/^\/api\/v1/, '')}) : null;
  const previewable = result?.mime_type && ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain'].includes(result.mime_type);
  const error = create.error || job.error;
  const prepare = () => {
    const operationId = jobId ? crypto.randomUUID() : requestId;
    setRequestId(operationId);
    create.mutate({operation_id: operationId, action: 'download', documento_id: id});
  };
  return <div className="storage-actions">
    {busy ? <span role="status">Preparando documento…</span> : <>
      {url && (previewable ? <button type="button" className="secondary-button" onClick={event => onPreview(url, event.currentTarget)}>Ver documento</button>
        : <a className="secondary-button" href={url}>Descargar documento</a>)}
      <button type="button" className="secondary-button" onClick={prepare}>{url ? 'Preparar de nuevo' : 'Preparar documento'}</button>
      {canRefresh && <button type="button" className="secondary-button" onClick={() => create.mutate({operation_id: crypto.randomUUID(), action: 'refresh', documento_id: id})}>Revisar cambios</button>}
    </>}
    {error && <span role="alert" className="document-error">{storageError(error)}</span>}
    {job.data?.status === 'failed' && <span role="alert" className="document-error">{job.data.error_message}</span>}
    {job.data?.kind === 'refresh' && job.data.status === 'completed' && <span role="status">Archivo revisado. Solo firma.</span>}
  </div>;
}
