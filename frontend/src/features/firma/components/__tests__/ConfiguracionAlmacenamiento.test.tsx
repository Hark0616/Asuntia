import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse } from 'axios';
import { apiClient } from '@/lib/axios';
import * as storage from '../../api/storage';
import type { StorageOperation, StorageStatus } from '@/types/storage';
import { ConfiguracionAlmacenamiento } from '../ConfiguracionAlmacenamiento';

let state: StorageStatus;
let jobs: Map<string, StorageOperation>;
const response = (data: unknown) => ({data} as AxiosResponse);

function mount() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
  render(<QueryClientProvider client={client}><ConfiguracionAlmacenamiento /></QueryClientProvider>);
}

beforeEach(() => {
  window.history.replaceState({}, '', '/oficina/ajustes/almacenamiento');
  jobs = new Map();
  state = {provider: 'local', configured: true, worker_ready: true, connection_id: null, connections: []};
  vi.spyOn(apiClient, 'get').mockImplementation(async url => {
    if (url === '/storage/status') return response(structuredClone(state));
    if (url?.startsWith('/storage/operations/')) return response(jobs.get(url.split('/').at(-1)!));
    throw new Error(`Unexpected GET ${url}`);
  });
  vi.spyOn(apiClient, 'post').mockImplementation(async (url, data) => {
    if (url === '/storage/onedrive/authorize') return response({authorization_url: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?state=opaque', operation_id: 'oauth'});
    if (url === '/storage/destination') {
      state = {...state, ...(data as Partial<StorageStatus>)};
      return response(state);
    }
    if (url === '/storage/operations') {
      const command = data as storage.StorageCommand;
      const result = command.action === 'browse' ? {items: command.item_id === 'root' ? [{id: 'folder-1', name: 'Expedientes actuales', folder: true, size: 0}] : []} : {connection_id: 'connection'};
      const job: StorageOperation = {id: command.operation_id, kind: command.action, status: 'completed', result,
        error_code: null, error_message: null, expires_at: '2099-01-01T00:00:00Z'};
      jobs.set(job.id, job);
      if (command.action === 'root') state = {...state, provider: 'onedrive', connection_id: 'connection', connections: state.connections.map(c => ({...c, root_folder_id: command.item_id!, root_folder_name: 'Expedientes actuales'}))};
      return response(job);
    }
    if (url?.endsWith('/disconnect')) {
      state.connections = state.connections.map(c => ({...c, is_active: false}));
      return response(null);
    }
    throw new Error(`Unexpected POST ${url}`);
  });
});
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });

describe('Almacenamiento por firma', () => {
  it('presenta el destino real y la conexión OneDrive sin exponer credenciales', async () => {
    mount();
    expect(await screen.findByText('Servidor local')).toBeInTheDocument();
    expect(screen.getByText('OneDrive personal')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Activo'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Conectar OneDrive'})).toBeEnabled();
  });
  it('impide iniciar una conexión sin configuración y sin procesador', async () => {
    state.configured = state.worker_ready = false;
    mount();
    expect(await screen.findByText('Falta configurar la conexión Microsoft del servidor.')).toBeInTheDocument();
    expect(screen.getByText('Procesador de archivos sin conexión.')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Conectar OneDrive'})).toBeDisabled();
  });
  it('inicia la autorización oficial al pulsar conectar', async () => {
    const open = vi.spyOn(storage, 'openMicrosoftAuthorization').mockImplementation(() => {});
    mount();
    await userEvent.click(await screen.findByRole('button', {name: 'Conectar OneDrive'}));
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringContaining('https://login.microsoftonline.com/consumers/')));
  });
  it('permite volver a local sin desconectar ni trasladar los archivos anteriores', async () => {
    state.provider = 'onedrive';
    mount();
    await userEvent.click(await screen.findByRole('button', {name: 'Usar almacenamiento local'}));
    expect(await screen.findByRole('button', {name: 'Activo'})).toBeDisabled();
    expect(apiClient.post).toHaveBeenCalledWith('/storage/destination', {provider: 'local'});
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it('recupera la autorización y elige una carpeta existente sin crearla', async () => {
    window.history.replaceState({}, '', '/oficina/ajustes/almacenamiento?operation=callback-job');
    state.connections = [{id: 'connection', provider: 'onedrive', account_name: 'Firma real', root_folder_id: null, root_folder_name: null, is_active: true}];
    jobs.set('callback-job', {id: 'callback-job', kind: 'connect', status: 'completed', result: {connection_id: 'connection'},
      error_code: null, error_message: null, expires_at: '2099-01-01T00:00:00Z'});
    mount();
    await userEvent.click(await screen.findByRole('button', {name: 'Expedientes actuales'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Usar esta carpeta'}));
    expect(await screen.findByText('Destino de nuevas cargas', {selector: '.badge'})).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/storage/operations', expect.objectContaining({action: 'root', item_id: 'folder-1'}));
    expect(window.location.search).toBe('');
  });
  it('un fallo de consulta ofrece reintento y no presenta un destino inventado', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network'));
    mount();
    expect(await screen.findByText('No se pudo consultar el almacenamiento.')).toBeInTheDocument();
    expect(screen.queryByText('Servidor local')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Reintentar'}));
    expect(await screen.findByText('Servidor local')).toBeInTheDocument();
  });
});
