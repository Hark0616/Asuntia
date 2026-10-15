import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { OneDriveBrowser } from '@/features/firma/components/OneDriveBrowser';
import { fetchCaseDestination, startStorageOperation, storageError, useStorageOperation } from '@/features/firma/api/storage';
import type { StorageItem } from '@/types/storage';
import { TIPO_LABELS } from '../tipos';

export function OneDriveFiles({asuntoId, canPublish, onLinked}: {asuntoId: string; canPublish: boolean; onLinked: () => void}) {
  const destination = useQuery({queryKey: ['storage-case', asuntoId], queryFn: () => fetchCaseDestination(asuntoId), retry: false});
  const [bind, setBind] = useState(false);
  const [selected, setSelected] = useState<StorageItem | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('anexo');
  const [shared, setShared] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const completed = useRef<string | null>(null);
  const create = useMutation({mutationFn: startStorageOperation, onSuccess: operation => setOperationId(operation.id)});
  const job = useStorageOperation(operationId);
  useEffect(() => {
    if (job.data?.status !== 'completed' || completed.current === job.data.id) return;
    completed.current = job.data.id;
    if (job.data.kind === 'bind_case') {
      setBind(false);
      destination.refetch();
    } else if (job.data.kind === 'link') onLinked();
  }, [job.data]);
  const busy = create.isPending || ['queued', 'running'].includes(job.data?.status || '');
  const error = destination.error || create.error || job.error;
  const state = destination.data;
  if (destination.isLoading) return <p role="status">Consultando destino documental…</p>;
  if (destination.isError) return <div><p role="alert" className="document-error">{storageError(destination.error)}</p>
    <button type="button" className="secondary-button" onClick={() => destination.refetch()}>Consultar conexión</button></div>;
  if (!state?.connection_id) return <div><p role="status">Activa una conexión de OneDrive en Ajustes → Almacenamiento.</p>
    <button type="button" className="secondary-button" onClick={() => destination.refetch()}>Consultar conexión</button></div>;
  return <div className="storage-operation">
    {error && <p role="alert" className="document-error">{storageError(error)}</p>}
    {job.data?.status === 'failed' && <p role="alert" className="document-error">{job.data.error_message}</p>}
    {busy && <p role="status">Procesando archivo en OneDrive…</p>}
    {state.can_bind && <button type="button" className="secondary-button" disabled={busy}
      onClick={() => { setBind(!bind); setSelected(null); }}>{bind ? 'Volver a archivos' : state.folder_id ? 'Cambiar carpeta del expediente' : 'Asignar carpeta del expediente'}</button>}
    {!state.folder_id && !bind && <p className="muted">El expediente aún no tiene una carpeta vinculada.</p>}
    {(bind || state.folder_id) && !selected && <OneDriveBrowser key={`${state.connection_id}-${bind}-${state.folder_id}`}
      connectionId={state.connection_id} rootId={bind ? state.root_folder_id || 'root' : state.folder_id!}
      asuntoId={asuntoId} foldersOnly={bind} disabled={busy} onSelect={item => {
        if (bind) create.mutate({operation_id: crypto.randomUUID(), action: 'bind_case', asunto_id: asuntoId,
          connection_id: state.connection_id!, item_id: item.id});
        else { setSelected(item); setName(item.name.replace(/\.[^/.]+$/, '')); setRequestId(crypto.randomUUID()); }
      }} />}
    {selected && <form className="document-upload" onSubmit={event => {
      event.preventDefault();
      if (!name.trim() || busy) return;
      create.mutate({operation_id: requestId, action: 'link', asunto_id: asuntoId, connection_id: state.connection_id!,
        item_id: selected.id, nombre_funcional: name.trim(), tipo_documental: type, compartido_con_cliente: canPublish && shared});
    }}>
      <fieldset className="document-fieldset" disabled={busy}>
        <div className="form-grid">
          <div className="field full"><label htmlFor="onedrive-document-name">Nombre del documento</label>
            <input id="onedrive-document-name" required maxLength={255} value={name} onChange={event => {setName(event.target.value); setRequestId(crypto.randomUUID());}} /></div>
          <div className="field"><label htmlFor="onedrive-document-type">Tipo documental</label>
            <select id="onedrive-document-type" value={type} onChange={event => {setType(event.target.value); setRequestId(crypto.randomUUID());}}>
              {Object.entries(TIPO_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select></div>
          {canPublish && <div className="field full row"><input id="onedrive-shared" type="checkbox" checked={shared}
            onChange={event => {setShared(event.target.checked); setRequestId(crypto.randomUUID());}} /><label htmlFor="onedrive-shared">Compartir con el cliente</label></div>}
          <div className="storage-actions field full"><button type="submit" className="primary-button">Vincular documento</button>
            <button type="button" className="secondary-button" onClick={() => setSelected(null)}>Elegir otro archivo</button></div>
        </div>
      </fieldset>
    </form>}
  </div>;
}
