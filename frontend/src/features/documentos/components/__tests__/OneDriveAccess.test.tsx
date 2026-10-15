import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AxiosResponse } from 'axios';
import { apiClient } from '@/lib/axios';
import { OneDriveAccess } from '../OneDriveAccess';

afterEach(() => vi.restoreAllMocks());
describe('Lectura OneDrive desde Asuntia', () => {
  it('prepara una descarga privada sin enlaces públicos del proveedor', async () => {
    const job = {id: 'job', kind: 'download', status: 'completed', result: {content_url: '/api/v1/storage/operations/job/content', mime_type: 'application/pdf', name: 'Poder.pdf'}};
    vi.spyOn(apiClient, 'post').mockResolvedValue({data: job} as AxiosResponse);
    vi.spyOn(apiClient, 'get').mockResolvedValue({data: job} as AxiosResponse);
    render(<QueryClientProvider client={new QueryClient()}><OneDriveAccess id="documento" canRefresh={false} onRefresh={vi.fn()} onPreview={vi.fn()} /></QueryClientProvider>);
    await userEvent.click(screen.getByRole('button', {name: 'Preparar documento'}));
    expect(await screen.findByRole('link', {name: 'Descargar documento'})).toHaveAttribute('href', '/api/v1/storage/operations/job/content');
    expect(apiClient.post).toHaveBeenCalledWith('/storage/operations', expect.objectContaining({action: 'download', documento_id: 'documento'}));
    expect(screen.queryByRole('button', {name: 'Revisar cambios'})).not.toBeInTheDocument();
  });
  it('muestra un cambio externo sin abrir contenido no revisado', async () => {
    const job = {id: 'job', kind: 'download', status: 'failed', result: null, error_message: 'El archivo cambió en OneDrive. La firma debe revisarlo antes de compartirlo.'};
    vi.spyOn(apiClient, 'post').mockResolvedValue({data: job} as AxiosResponse);
    vi.spyOn(apiClient, 'get').mockResolvedValue({data: job} as AxiosResponse);
    render(<QueryClientProvider client={new QueryClient()}><OneDriveAccess id="documento" canRefresh={false} onRefresh={vi.fn()} onPreview={vi.fn()} /></QueryClientProvider>);
    await userEvent.click(screen.getByRole('button', {name: 'Preparar documento'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('El archivo cambió en OneDrive.');
    expect(screen.queryByRole('link', {name: 'Descargar documento'})).not.toBeInTheDocument();
  });
  it('revisar una edición externa actualiza el expediente una sola vez', async () => {
    const refresh = vi.fn();
    const job = {id: 'refresh-job', kind: 'refresh', status: 'completed', result: {documento_id: 'documento'}};
    vi.spyOn(apiClient, 'post').mockResolvedValue({data: job} as AxiosResponse);
    vi.spyOn(apiClient, 'get').mockResolvedValue({data: job} as AxiosResponse);
    render(<QueryClientProvider client={new QueryClient()}><OneDriveAccess id="documento" canRefresh onRefresh={refresh} onPreview={vi.fn()} /></QueryClientProvider>);
    await userEvent.click(screen.getByRole('button', {name: 'Revisar cambios'}));
    expect(await screen.findByText('Archivo revisado. Solo firma.')).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });
});
