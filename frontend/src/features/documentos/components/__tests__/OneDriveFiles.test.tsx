import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse } from 'axios';
import { apiClient } from '@/lib/axios';
import { OneDriveFiles } from '../OneDriveFiles';

vi.mock('@/features/firma/components/OneDriveBrowser', () => ({OneDriveBrowser: ({onSelect}: {onSelect: (item: unknown) => void}) =>
  <button onClick={() => onSelect({id: 'source', name: 'Original.pdf', folder: false, size: 100})}>Original.pdf</button>}));
const response = (data: unknown) => ({data} as AxiosResponse);
function mount(onLinked = vi.fn()) {
  const cache = new QueryClient({defaultOptions: {queries: {retry: false}}});
  render(<QueryClientProvider client={cache}><OneDriveFiles asuntoId="case" canPublish onLinked={onLinked} /></QueryClientProvider>);
}
afterEach(() => vi.restoreAllMocks());

describe('Archivos existentes de OneDrive', () => {
  it('conserva el error de consulta y permite reintentar sin inventar una conexión ausente', async () => {
    const get = vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Network'));
    mount();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Activa una conexión/)).not.toBeInTheDocument();
    get.mockResolvedValueOnce(response({provider: 'local', connection_id: null}));
    await userEvent.click(screen.getByRole('button', {name: 'Consultar conexión'}));
    expect(await screen.findByText(/Activa una conexión/)).toBeInTheDocument();
  });
  it('vincula el archivo por su identidad y permanece privado por defecto', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async url => url?.startsWith('/storage/operations/')
      ? response({id: 'job', kind: 'link', status: 'completed', result: {documento_id: 'document'}})
      : response({provider: 'onedrive', connection_id: 'connection', folder_id: 'folder', can_bind: true}));
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(response({id: 'job', kind: 'link', status: 'queued'}));
    const linked = vi.fn();
    mount(linked);
    await userEvent.click(await screen.findByRole('button', {name: 'Original.pdf'}));
    expect(screen.getByRole('checkbox', {name: 'Compartir con el cliente'})).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', {name: 'Vincular documento'}));
    expect(post).toHaveBeenCalledWith('/storage/operations', expect.objectContaining({action: 'link',
      connection_id: 'connection', asunto_id: 'case', item_id: 'source', nombre_funcional: 'Original', compartido_con_cliente: false}));
    await waitFor(() => expect(linked).toHaveBeenCalledTimes(1));
  });
  it('conserva los datos cuando OneDrive rechaza la vinculación', async () => {
    vi.spyOn(apiClient, 'get').mockImplementation(async url => url?.startsWith('/storage/operations/')
      ? response({id: 'job', kind: 'link', status: 'failed', error_message: 'El archivo ya no está disponible.'})
      : response({provider: 'onedrive', connection_id: 'connection', folder_id: 'folder', can_bind: false}));
    vi.spyOn(apiClient, 'post').mockResolvedValue(response({id: 'job', kind: 'link', status: 'queued'}));
    const linked = vi.fn();
    mount(linked);
    await userEvent.click(await screen.findByRole('button', {name: 'Original.pdf'}));
    await userEvent.click(screen.getByRole('button', {name: 'Vincular documento'}));
    expect(await screen.findByText('El archivo ya no está disponible.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('Original');
    expect(linked).not.toHaveBeenCalled();
  });
});
