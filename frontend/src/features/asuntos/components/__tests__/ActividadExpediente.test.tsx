import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActividadExpediente } from '../ActividadExpediente';
import { actualizarVisibilidadNovedadAPI, crearNovedadAPI } from '@/features/asuntos/api/asuntos';
import type { Novedad } from '@/types/api';

vi.mock('@/features/asuntos/api/asuntos', () => ({
  crearNovedadAPI: vi.fn(), actualizarVisibilidadNovedadAPI: vi.fn(),
}));

const nota: Novedad = {
  id: 'nota-auxiliar', asunto_id: 'asunto-1', tipo: 'nota', titulo: 'Revisión de soportes',
  descripcion: 'Falta una certificación.', publicado_al_cliente: false, created_at: '2026-10-02T12:00:00Z',
};

function prepare(novedades = [nota], canPublish = true) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['asuntos'], []);
  queryClient.setQueryData(['portal', 'asuntos'], []);
  const view = render(<QueryClientProvider client={queryClient}>
    <ActividadExpediente asuntoId="asunto-1" novedades={novedades} canPublish={canPublish} />
  </QueryClientProvider>);
  return { queryClient, ...view };
}

beforeEach(() => vi.resetAllMocks());

describe('ActividadExpediente', () => {
  it('publica la misma nota sin copiar su texto e invalida oficina y portal', async () => {
    const user = userEvent.setup();
    vi.mocked(actualizarVisibilidadNovedadAPI).mockResolvedValue({ ...nota, publicado_al_cliente: true });
    const { queryClient } = prepare();
    await user.click(screen.getByRole('button', { name: 'Publicar al cliente: Revisión de soportes' }));
    await waitFor(() => expect(actualizarVisibilidadNovedadAPI).toHaveBeenCalledWith('nota-auxiliar', { publicado_al_cliente: true }));
    expect(crearNovedadAPI).not.toHaveBeenCalled();
    expect(await screen.findByText('Nota publicada')).toBeInTheDocument();
    expect(queryClient.getQueryState(['asuntos'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['portal', 'asuntos'])?.isInvalidated).toBe(true);
  });

  it('retira la publicación de la nota y conserva su contenido en actividad', async () => {
    const user = userEvent.setup();
    vi.mocked(actualizarVisibilidadNovedadAPI).mockResolvedValue(nota);
    prepare([{ ...nota, publicado_al_cliente: true }]);
    await user.click(screen.getByRole('button', { name: 'Retirar del portal: Revisión de soportes' }));
    expect(await screen.findByText('Nota retirada del portal')).toBeInTheDocument();
    expect(actualizarVisibilidadNovedadAPI).toHaveBeenCalledWith(nota.id, { publicado_al_cliente: false });
    expect(screen.getByText(nota.descripcion)).toBeInTheDocument();
  });

  it('el auxiliar puede escribir y no recibe acciones de publicación', () => {
    prepare([nota, { ...nota, id: 'publicada', publicado_al_cliente: true }], false);
    expect(screen.getByLabelText('Contenido')).toBeEnabled();
    expect(screen.queryByLabelText('Visibilidad')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar al cliente|Retirar del portal/ })).not.toBeInTheDocument();
  });

  it('los eventos de documentos y pasos se gestionan desde su origen', () => {
    prepare([{ ...nota, tipo: 'documento_incorporado' }, { ...nota, id: 'paso', tipo: 'paso_completado' }]);
    expect(screen.queryByRole('button', { name: /Publicar al cliente|Retirar del portal/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Actividad del sistema')).toHaveLength(2);
  });

  it('un fallo al publicar conserva tanto la nota como el texto que se está redactando', async () => {
    const user = userEvent.setup();
    vi.mocked(actualizarVisibilidadNovedadAPI).mockRejectedValue({ response: { data: { detail: 'Sin permiso para publicar.' } } });
    prepare();
    await user.type(screen.getByLabelText('Contenido'), 'Nueva captura incompleta.');
    await user.click(screen.getByRole('button', { name: /Publicar al cliente:/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sin permiso para publicar.');
    expect(screen.getByLabelText('Contenido')).toHaveValue('Nueva captura incompleta.');
    expect(screen.getByText(nota.descripcion)).toBeInTheDocument();
  });
});
