import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  deleteDocumentoAPI,
  fetchDocumentosAsunto,
  toggleVisibilidadDocumentoAPI,
  uploadDocumentoAPI,
} from '../../api/documentos';
import { DocumentosTab } from '../DocumentosTab';

vi.mock('../../api/documentos', () => ({
  deleteDocumentoAPI: vi.fn(),
  fetchDocumentosAsunto: vi.fn(),
  toggleVisibilidadDocumentoAPI: vi.fn(),
  uploadDocumentoAPI: vi.fn(),
}));

const mockedFetchDocumentos = vi.mocked(fetchDocumentosAsunto);
vi.mocked(deleteDocumentoAPI);
vi.mocked(toggleVisibilidadDocumentoAPI);
vi.mocked(uploadDocumentoAPI);

function renderDocumentos() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <DocumentosTab asuntoId="asunto-1" />
    </QueryClientProvider>,
  );
}

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
});
