import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { HardDrive, RefreshCw } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import { OneDriveBrowser } from './OneDriveBrowser';
import { authorizeOneDrive, disconnectStorage, fetchStorageStatus, openMicrosoftAuthorization,
  setStorageDestination, startStorageOperation, storageError, useStorageOperation } from '../api/storage';
import '../storage.css';

export function ConfiguracionAlmacenamiento() {
  const cache = useQueryClient();
  const query = useQuery({queryKey: ['storage-status'], queryFn: fetchStorageStatus, retry: false});
  const [picker, setPicker] = useState<string | null>(null);
  const [operationId, setOperationId] = useState<string | null>(() => new URLSearchParams(window.location.search).get('operation'));
  const consumed = useRef<string | null>(null);
  const operation = useStorageOperation(operationId);
  const authorize = useMutation({mutationFn: authorizeOneDrive, onSuccess: data => openMicrosoftAuthorization(data.authorization_url)});
  const select = useMutation({mutationFn: setStorageDestination, onSuccess: () => cache.invalidateQueries({queryKey: ['storage-status']})});
  const disconnect = useMutation({mutationFn: disconnectStorage, onSuccess: () => cache.invalidateQueries({queryKey: ['storage-status']})});
  const folder = useMutation({mutationFn: startStorageOperation, onSuccess: job => setOperationId(job.id)});
  useEffect(() => {
    const job = operation.data;
    if (job?.status !== 'completed' || consumed.current === job.id) return;
    consumed.current = job.id;
    cache.invalidateQueries({queryKey: ['storage-status']});
    setPicker(job.kind === 'connect' ? job.result?.connection_id || null : null);
    const url = new URL(window.location.href);
    url.searchParams.delete('operation');
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
  }, [operation.data, cache]);
  const activeJob = operation.data && ['queued', 'running'].includes(operation.data.status);
  const busy = authorize.isPending || select.isPending || disconnect.isPending || folder.isPending || Boolean(activeJob);
  const error = query.error || authorize.error || select.error || disconnect.error || folder.error || operation.error;
  if (query.isLoading) return <div className="panel storage-panel" role="status">Cargando almacenamiento…</div>;
  if (!query.data) return <div className="panel storage-panel" role="alert">
    <p>No se pudo consultar el almacenamiento.</p><button type="button" className="secondary-button" onClick={() => query.refetch()}>Reintentar</button>
  </div>;
  const state = query.data;
  return <section className="panel storage-panel" aria-labelledby="storage-title">
    <div className="section-title"><h3 id="storage-title">Almacenamiento de la firma <Tooltip content="El destino se aplica a nuevas cargas. Microsoft autoriza lectura y escritura de los archivos de la cuenta; la carpeta seleccionada delimita el uso en Asuntia. Los documentos existentes conservan su conexión." /></h3><HardDrive size={18} aria-hidden="true" /></div>
    {error && <p role="alert" className="document-error">{storageError(error)}</p>}
    <div className="storage-summary">
      <div className="storage-identity"><strong>Servidor local</strong><span className="muted small">{state.provider === 'local' ? 'Destino de nuevas cargas' : 'Disco del servidor de Asuntia'}</span></div>
      <button type="button" className="secondary-button" disabled={busy || state.provider === 'local'}
        onClick={() => select.mutate({provider: 'local'})}>{state.provider === 'local' ? 'Activo' : 'Usar almacenamiento local'}</button>
    </div>
    <div className="storage-summary">
      <div className="storage-identity"><strong>OneDrive personal</strong>
        {!state.configured && <span className="muted small">Falta configurar la conexión Microsoft del servidor.</span>}
        {!state.worker_ready && <span className="muted small">Procesador de archivos sin conexión.</span>}
      </div>
      <button type="button" className="primary-button" disabled={busy || !state.configured || !state.worker_ready}
        onClick={() => authorize.mutate()}>Conectar OneDrive</button>
    </div>
    {state.connections.map(connection => <div key={connection.id}>
      <div className="storage-connection">
        <div className="storage-identity"><strong>{connection.account_name || 'Cuenta OneDrive'}</strong>
          <span className="muted small">{connection.root_folder_name || 'Sin carpeta seleccionada'}</span>
          <span className={`badge ${connection.is_active ? 'mint' : 'neutral'}`}>{connection.is_active ? state.provider === 'onedrive' && state.connection_id === connection.id ? 'Destino de nuevas cargas' : 'Conectada' : 'Desconectada'}</span>
        </div>
        {connection.is_active && <div className="storage-actions">
          <button type="button" className="secondary-button" disabled={busy || !state.worker_ready}
            onClick={() => setPicker(picker === connection.id ? null : connection.id)}>{picker === connection.id ? 'Cerrar carpetas' : 'Elegir carpeta'}</button>
          {connection.root_folder_id && state.connection_id !== connection.id && <button type="button" className="secondary-button" disabled={busy}
            onClick={() => select.mutate({provider: 'onedrive', connection_id: connection.id})}>Usar OneDrive</button>}
          <button type="button" className="secondary-button" disabled={busy}
            onClick={() => { if (confirm('¿Desconectar esta cuenta de OneDrive? Los archivos se conservarán.')) disconnect.mutate(connection.id); }}>Desconectar</button>
        </div>}
      </div>
      {picker === connection.id && connection.is_active && <OneDriveBrowser key={connection.id} connectionId={connection.id}
        foldersOnly disabled={busy} onSelect={item => folder.mutate({operation_id: crypto.randomUUID(),
          action: 'root', connection_id: connection.id, item_id: item.id})} />}
    </div>)}
    {activeJob && <p className="storage-operation" role="status">Procesando conexión con OneDrive…</p>}
    {operation.data?.status === 'failed' && <p role="alert" className="document-error">{operation.data.error_message}</p>}
    {operation.isError && <button type="button" className="secondary-button" onClick={() => operation.refetch()}>Consultar resultado</button>}
    <button type="button" className="secondary-button" disabled={query.isFetching || busy} onClick={() => query.refetch()}>
      <RefreshCw size={16} aria-hidden="true" /> Actualizar conexión
    </button>
  </section>;
}
