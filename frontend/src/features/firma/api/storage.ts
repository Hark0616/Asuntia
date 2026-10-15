import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import type { StorageOperation, StorageStatus } from '@/types/storage';

export interface StorageCommand {
  operation_id: string;
  action: 'browse' | 'root' | 'bind_case' | 'link' | 'download' | 'refresh';
  connection_id?: string;
  asunto_id?: string;
  documento_id?: string;
  item_id?: string;
  cursor?: string;
  nombre_funcional?: string;
  tipo_documental?: string;
  compartido_con_cliente?: boolean;
  for_binding?: boolean;
}

export const storageError = (error: unknown) => {
  const detail = isAxiosError(error) ? error.response?.data?.detail : null;
  return typeof detail === 'string' ? detail : 'No se pudo completar la operación. Inténtalo de nuevo.';
};
export const fetchStorageStatus = async () => (await apiClient.get<StorageStatus>('/storage/status')).data;
export const setStorageDestination = async (payload: {provider: 'local' | 'onedrive'; connection_id?: string}) =>
  (await apiClient.post<StorageStatus>('/storage/destination', payload)).data;
export const authorizeOneDrive = async () =>
  (await apiClient.post<{authorization_url: string; operation_id: string}>('/storage/onedrive/authorize')).data;
export const openMicrosoftAuthorization = (url: string) => window.location.assign(url);
export const disconnectStorage = async (id: string) => { await apiClient.post(`/storage/connections/${id}/disconnect`); };
export const startStorageOperation = async (command: StorageCommand) =>
  (await apiClient.post<StorageOperation>('/storage/operations', command)).data;
export const fetchStorageOperation = async (id: string, signal?: AbortSignal) =>
  (await apiClient.get<StorageOperation>(`/storage/operations/${id}`, {signal})).data;
export const fetchCaseDestination = async (id: string) => (await apiClient.get<{
  provider: string; connection_id: string | null; folder_id: string | null;
  root_folder_id: string | null; can_bind: boolean;
}>(`/asuntos/${id}/documentos/destination`)).data;

export function useStorageOperation(id: string | null) {
  return useQuery({queryKey: ['storage-operation', id], enabled: Boolean(id),
    queryFn: ({signal}) => fetchStorageOperation(id!, signal), retry: false,
    refetchInterval: (query) => ['queued', 'running'].includes(query.state.data?.status || '') ? 1000 : false});
}
