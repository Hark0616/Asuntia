import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/axios';

import {
  deleteDocumentoAPI,
  fetchDocumentosAsunto,
  toggleVisibilidadDocumentoAPI,
  uploadDocumentoAPI,
  type DocumentoAPI,
} from '../../api/documentos';
import { DocumentosTab } from '../DocumentosTab';

vi.mock('../../api/documentos', () => ({
  deleteDocumentoAPI: vi.fn(),
  fetchDocumentosAsunto: vi.fn(),
  toggleVisibilidadDocumentoAPI: vi.fn(),
  uploadDocumentoAPI: vi.fn(),
}));

const mockedFetchDocumentos = vi.mocked(fetchDocumentosAsunto);
const localDoc: DocumentoAPI = {
  id: 'doc-1', firma_id: 'firma-1', asunto_id: 'asunto-1',
  nombre_funcional: 'Poder del cliente', tipo_documental: 'poder', subcarpeta: 'anexo',
  provider: 'local', external_file_id: 'local-1', web_view_url: '/local-1',
  mime_type: 'application/pdf',
  compartido_con_cliente: false, estado_revision: 'recibido',
  created_at: '2026-07-29T10:00:00Z', updated_at: '2026-07-29T10:00:00Z',
};
const cloudDoc: DocumentoAPI = {
  ...localDoc, id: 'doc-2', nombre_funcional: 'Solicitud final',
  tipo_documental: 'escrito_solicitud', subcarpeta: 'solicitud',
  provider: 'google_drive', external_file_id: 'drive-1',
  web_view_url: 'https://drive.google.com/file/drive-1', compartido_con_cliente: true,
};
const originalBaseURL = apiClient.defaults.baseURL;

function renderDocumentos(
  props: { isReadOnly?: boolean; canManagePublication?: boolean } = {},
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  }),
) {
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentosTab asuntoId="asunto-1" {...props} />
    </QueryClientProvider>,
  );
  return queryClient;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedFetchDocumentos.mockResolvedValue([localDoc, cloudDoc]);
  vi.mocked(uploadDocumentoAPI).mockResolvedValue(localDoc);
  vi.mocked(toggleVisibilidadDocumentoAPI).mockResolvedValue({ ...localDoc, compartido_con_cliente: true });
  vi.mocked(deleteDocumentoAPI).mockResolvedValue(undefined);
});

afterEach(() => {
  apiClient.defaults.baseURL = originalBaseURL;
  vi.restoreAllMocks();
});

describe('DocumentosTab', () => {
  it('agrupa documentos por carpeta derivada y evita clasificar dos veces', async () => {
    const user = userEvent.setup();
    mockedFetchDocumentos.mockResolvedValue([
      {
        id: 'doc-1',
        firma_id: 'firma-1',
        asunto_id: 'asunto-1',
        asunto_paso_id: 'paso-1',
        nombre_funcional: 'Poder del cliente',
        tipo_documental: 'poder',
        subcarpeta: 'anexo',
        provider: 'local',
        external_file_id: 'local-1',
        web_view_url: '/local-1',
        compartido_con_cliente: false,
        estado_revision: 'recibido',
        created_at: '2026-07-29T10:00:00Z',
        updated_at: '2026-07-29T10:00:00Z',
      },
      {
        id: 'doc-2',
        firma_id: 'firma-1',
        asunto_id: 'asunto-1',
        asunto_paso_id: 'paso-3',
        nombre_funcional: 'Solicitud final',
        tipo_documental: 'escrito_solicitud',
        subcarpeta: 'solicitud',
        provider: 'google_drive',
        external_file_id: 'drive-1',
        web_view_url: 'https://drive.google.com/file/drive-1',
        compartido_con_cliente: true,
        estado_revision: 'recibido',
        created_at: '2026-07-29T11:00:00Z',
        updated_at: '2026-07-29T11:00:00Z',
      },
    ]);

    renderDocumentos();

    expect(await screen.findByText('01_Anexos (Insumos cliente)')).toBeInTheDocument();
    expect(screen.getByText('02_Solicitud (Escrito borrador/final)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    expect(screen.getByLabelText(/Tipo documental/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Subcarpeta de destino')).not.toBeInTheDocument();
  });

  it('el portal consulta compartidos y oculta subir, publicar y archivar', async () => {
    mockedFetchDocumentos.mockResolvedValue([cloudDoc]);
    renderDocumentos({ isReadOnly: true, canManagePublication: true });

    expect(await screen.findByText('Solicitud final')).toBeInTheDocument();
    expect(mockedFetchDocumentos).toHaveBeenCalledWith('asunto-1', true);
    expect(screen.getByRole('heading', { name: /Documentos compartidos/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solicitudes' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Subir documento' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compartir|Ocultar|Archivar/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Solo firma')).not.toBeInTheDocument();
  });

  it('el auxiliar puede subir un documento privado sin controles de publicación ni archivo', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    renderDocumentos({}, queryClient);
    await screen.findByText('Poder del cliente');
    expect(screen.queryByRole('button', { name: /Compartir|Ocultar|Archivar/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    expect(screen.queryByLabelText('Compartir con el cliente')).not.toBeInTheDocument();
    const file = new File(['soporte'], 'Poder.pdf', { type: 'application/pdf' });
    await user.upload(screen.getByLabelText('Archivo'), file);
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('Poder');
    // JSDOM no reconoce el archivo de user-event en la validación nativa de required.
    fireEvent.submit(screen.getByLabelText('Archivo').closest('form')!);

    await waitFor(() => expect(uploadDocumentoAPI).toHaveBeenCalledTimes(1));
    const [asuntoId, payload] = vi.mocked(uploadDocumentoAPI).mock.calls[0];
    expect(asuntoId).toBe('asunto-1');
    expect(payload.get('file')).toBe(file);
    expect(payload.get('nombre_funcional')).toBe('Poder');
    expect(payload.get('tipo_documental')).toBe('anexo');
    expect(payload.get('compartido_con_cliente')).toBe('false');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documentos', 'asunto-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['asuntos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['portal', 'asuntos'] });
    await waitFor(() => expect(screen.queryByLabelText('Archivo')).not.toBeInTheDocument());
  });

  it('compartir y archivar actualizan documentos, expediente y proyección externa', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderDocumentos({ canManagePublication: true }, queryClient);
    await screen.findByText('Poder del cliente');

    await user.click(screen.getByRole('button', { name: 'Compartir Poder del cliente con el cliente' }));
    await waitFor(() => expect(toggleVisibilidadDocumentoAPI).toHaveBeenCalledWith('doc-1', true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documentos', 'asunto-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['asuntos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['portal', 'asuntos'] });

    invalidate.mockClear();
    await user.click(screen.getByRole('button', { name: 'Archivar Poder del cliente' }));
    await waitFor(() => expect(deleteDocumentoAPI).toHaveBeenCalledWith('doc-1', expect.anything()));
    expect(window.confirm).toHaveBeenCalledWith('¿Archivar Poder del cliente?');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['documentos', 'asunto-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['asuntos'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['portal', 'asuntos'] });
  });

  it('ocultar un documento compartido envía false sin modificar otra captura', async () => {
    const user = userEvent.setup();
    renderDocumentos({ canManagePublication: true });
    await screen.findByText('Solicitud final');

    await user.click(screen.getByRole('button', { name: 'Ocultar Solicitud final al cliente' }));
    await waitFor(() => expect(toggleVisibilidadDocumentoAPI).toHaveBeenCalledWith('doc-2', false));
    expect(uploadDocumentoAPI).not.toHaveBeenCalled();
  });

  it('cancelar el archivo conserva el documento y no ejecuta la mutación', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderDocumentos({ canManagePublication: true });
    await screen.findByText('Poder del cliente');

    await user.click(screen.getByRole('button', { name: 'Archivar Poder del cliente' }));
    expect(deleteDocumentoAPI).not.toHaveBeenCalled();
    expect(screen.getByText('Poder del cliente')).toBeInTheDocument();
  });

  it('presenta un fallo de consulta y permite reintentar sin vacío falso', async () => {
    const user = userEvent.setup();
    mockedFetchDocumentos.mockRejectedValue(new Error('API no disponible'));
    renderDocumentos({ isReadOnly: true });

    expect(await screen.findByText('No pudimos cargar los documentos.')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay documentos compartidos.')).not.toBeInTheDocument();
    mockedFetchDocumentos.mockResolvedValue([cloudDoc]);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Solicitud final')).toBeInTheDocument();
    expect(screen.queryByText('No pudimos cargar los documentos.')).not.toBeInTheDocument();
  });

  it('mantiene los documentos consultados si falla una actualización', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['documentos', 'asunto-1', true], [cloudDoc]);
    mockedFetchDocumentos.mockRejectedValue(new Error('API no disponible'));
    renderDocumentos({ isReadOnly: true }, queryClient);

    expect(await screen.findByText('Mostrando los últimos documentos disponibles.')).toBeInTheDocument();
    expect(screen.getByText('Solicitud final')).toBeInTheDocument();
    expect(screen.queryByText('Aún no hay documentos compartidos.')).not.toBeInTheDocument();
  });

  it('reintenta una actualización fallida conservando los documentos durante la consulta', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['documentos', 'asunto-1', true], [cloudDoc]);
    mockedFetchDocumentos.mockRejectedValueOnce(new Error('API no disponible'));
    renderDocumentos({ isReadOnly: true }, queryClient);
    await screen.findByText('Mostrando los últimos documentos disponibles.');

    let resolveRetry!: (documents: DocumentoAPI[]) => void;
    mockedFetchDocumentos.mockReturnValueOnce(new Promise<DocumentoAPI[]>((resolve) => {
      resolveRetry = resolve;
    }));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('Solicitud final')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Consultando…' })).toBeDisabled();
    expect(screen.queryByText('Aún no hay documentos compartidos.')).not.toBeInTheDocument();

    resolveRetry([cloudDoc, { ...localDoc, compartido_con_cliente: true }]);
    expect(await screen.findByText('Poder del cliente')).toBeInTheDocument();
    expect(screen.getByText('Solicitud final')).toBeInTheDocument();
    expect(screen.queryByText('Mostrando los últimos documentos disponibles.')).not.toBeInTheDocument();
  });

  it('el preview local respeta la baseURL autenticada y cloud abre el enlace externo', async () => {
    const user = userEvent.setup();
    apiClient.defaults.baseURL = 'https://api.example.com/api/v1';
    renderDocumentos({ isReadOnly: true });
    await screen.findByText('Poder del cliente');

    const trigger = screen.getByRole('button', { name: 'Ver documento' });
    await user.click(trigger);
    const preview = screen.getByTitle('Previsualización de Poder del cliente');
    expect(preview).toHaveAttribute('src', 'https://api.example.com/api/v1/documentos/doc-1/preview');
    const previewRegion = screen.getByRole('region', { name: 'Previsualización de Poder del cliente' });
    expect(previewRegion).toHaveFocus();
    const nativePreview = within(previewRegion).getByRole('link', { name: 'Abrir documento' });
    expect(nativePreview).toHaveAttribute('href', 'https://api.example.com/api/v1/documentos/doc-1/preview');
    expect(nativePreview).toHaveAttribute('target', '_blank');
    expect(nativePreview).toHaveAttribute('rel', 'noreferrer');
    const external = within(screen.getByText('Solicitud final').closest('article')!)
      .getByRole('link', { name: 'Abrir documento' });
    expect(external).toHaveAttribute('href', cloudDoc.web_view_url);
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noreferrer');
    await user.click(screen.getByRole('button', { name: 'Cerrar previsualización' }));
    expect(screen.queryByTitle('Previsualización de Poder del cliente')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(['application/octet-stream', 'text/html', 'image/svg+xml', null, undefined])(
    'ofrece descarga local sin iframe para MIME %s', async (mimeType) => {
      apiClient.defaults.baseURL = 'https://api.example.com/api/v1';
      mockedFetchDocumentos.mockResolvedValue([{ ...localDoc, mime_type: mimeType }]);
      renderDocumentos({ isReadOnly: true });
      await screen.findByText('Poder del cliente');

      expect(screen.getByRole('link', { name: 'Descargar documento' }))
        .toHaveAttribute('href', 'https://api.example.com/api/v1/documentos/doc-1/preview');
      expect(screen.queryByRole('button', { name: 'Ver documento' })).not.toBeInTheDocument();
      expect(screen.queryByTitle('Previsualización de Poder del cliente')).not.toBeInTheDocument();
    },
  );

  it('fallar publicación conserva el documento y el formulario abierto', async () => {
    const user = userEvent.setup();
    vi.mocked(toggleVisibilidadDocumentoAPI).mockRejectedValue(new Error('API no disponible'));
    renderDocumentos({ canManagePublication: true });
    await screen.findByText('Poder del cliente');
    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    await user.type(screen.getByLabelText('Nombre del documento'), 'Acta pendiente');

    await user.click(screen.getByRole('button', { name: 'Compartir Poder del cliente con el cliente' }));
    expect(await screen.findByText('No fue posible actualizar el documento. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('Acta pendiente');
    expect(screen.getByText('Poder del cliente')).toBeInTheDocument();
  });

  it('fallar el archivo conserva la evidencia y permite reintentar', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteDocumentoAPI).mockRejectedValueOnce(new Error('API no disponible'));
    renderDocumentos({ canManagePublication: true });
    await screen.findByText('Poder del cliente');

    await user.click(screen.getByRole('button', { name: 'Archivar Poder del cliente' }));
    expect(await screen.findByText('No fue posible actualizar el documento. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByText('Poder del cliente')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Archivar Poder del cliente' }));
    await waitFor(() => expect(deleteDocumentoAPI).toHaveBeenCalledTimes(2));
  });

  it('fallar upload conserva archivo, nombre y autorización para reintentar', async () => {
    const user = userEvent.setup();
    vi.mocked(uploadDocumentoAPI).mockRejectedValueOnce(new Error('API no disponible'));
    renderDocumentos({ canManagePublication: true });
    await screen.findByText('Poder del cliente');
    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    const file = new File(['acta'], 'Acta.pdf', { type: 'application/pdf' });
    const fileInput = screen.getByLabelText('Archivo') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.selectOptions(screen.getByLabelText('Tipo documental'), 'acta_audiencia');
    await user.click(screen.getByLabelText('Compartir con el cliente'));
    fireEvent.submit(fileInput.closest('form')!);

    expect(await screen.findByText('No fue posible guardar el documento. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('Acta');
    expect(screen.getByLabelText('Tipo documental')).toHaveValue('acta_audiencia');
    expect(screen.getByLabelText('Compartir con el cliente')).toBeChecked();
    expect(fileInput.files?.[0]).toBe(file);

    fireEvent.submit(fileInput.closest('form')!);
    await waitFor(() => expect(uploadDocumentoAPI).toHaveBeenCalledTimes(2));
    const payload = vi.mocked(uploadDocumentoAPI).mock.calls[1][1];
    expect(payload.get('file')).toBe(file);
    expect(payload.get('nombre_funcional')).toBe('Acta');
    expect(payload.get('tipo_documental')).toBe('acta_audiencia');
    expect(payload.get('compartido_con_cliente')).toBe('true');
    await waitFor(() => expect(screen.queryByLabelText('Archivo')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Subir documento' }));
    expect(screen.getByLabelText('Nombre del documento')).toHaveValue('');
    expect(screen.getByLabelText('Compartir con el cliente')).not.toBeChecked();
  });
});
