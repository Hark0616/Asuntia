import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditarCliente } from '../EditarCliente';
import { EditarAsunto } from '@/features/asuntos/components/EditarAsunto';
import { fetchClienteAPI, actualizarClienteAPI } from '../../api/clientes';
import { fetchAsunto, actualizarDatosAsuntoAPI } from '@/features/asuntos/api/asuntos';
import type { AsuntoAPI } from '@/types/asunto';
import type { ClienteAPI } from '@/features/asuntos/api/asuntos';

vi.mock('../../api/clientes', () => ({ fetchClienteAPI: vi.fn(), actualizarClienteAPI: vi.fn() }));
vi.mock('@/features/asuntos/api/asuntos', () => ({ fetchAsunto: vi.fn(), actualizarDatosAsuntoAPI: vi.fn() }));
const cliente: ClienteAPI = {
  id: 'cliente-1', tipo_persona: 'natural', tipo_documento: 'CC', nombre: 'Cliente original',
  numero_documento: '123456', cedula: '123456', email: 'original@example.com', telefono: '3001234567',
  canal_preferido: 'email', portal_habilitado: true, asuntos_count: 0, rol: 'cliente',
  created_at: '2026-10-15T12:00:00Z', updated_at: '2026-10-15T12:00:00Z',
};
const asunto = { id: 'asunto-1', titulo: 'Asunto original', radicado_oficial: 'JUZ-ANTERIOR',
  fecha_apertura: '2026-10-15', updated_at: '2026-10-15T12:00:00Z' } as AsuntoAPI;
function prepare(node: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  for (const key of ['clientes', 'cliente-perfil', 'asuntos', 'tareas']) queryClient.setQueryData([key, 'contexto'], {});
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return queryClient;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchClienteAPI).mockResolvedValue(cliente);
  vi.mocked(actualizarClienteAPI).mockResolvedValue(cliente);
  vi.mocked(fetchAsunto).mockResolvedValue(asunto);
  vi.mocked(actualizarDatosAsuntoAPI).mockResolvedValue(asunto);
});
describe('Formularios de datos existentes', () => {
  it('corrige contacto, permite limpiar opcionales e invalida todas las proyecciones', async () => {
    const user = userEvent.setup(); const queryClient = prepare(<EditarCliente clienteId="cliente-1" />);
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    await screen.findByLabelText('Teléfono');
    await user.click(screen.getByRole('button', { name: 'Más información' }));
    expect(screen.getByRole('dialog')).toContainElement(screen.getByRole('tooltip'));
    await user.clear(screen.getByLabelText('Teléfono'));
    await user.clear(screen.getByLabelText('Nombre o razón social')); await user.type(screen.getByLabelText('Nombre o razón social'), 'Cliente corregido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(actualizarClienteAPI).toHaveBeenCalledWith('cliente-1', expect.objectContaining({
      nombre: 'Cliente corregido', telefono: null, direccion: null, expected_updated_at: cliente.updated_at,
    })));
    expect(actualizarClienteAPI).toHaveBeenCalledWith('cliente-1', expect.not.objectContaining({ habilitar_portal: expect.anything(), portal_user_id: expect.anything() }));
    await screen.findByText('Cambios guardados');
    for (const key of ['clientes', 'cliente-perfil', 'asuntos', 'tareas']) expect(queryClient.getQueryState([key, 'contexto'])?.isInvalidated).toBe(true);
  });
  it('corrige asunto y retira radicado oficial sin editar código ni responsables', async () => {
    const user = userEvent.setup(); prepare(<EditarAsunto asuntoId="asunto-1" />);
    await user.click(screen.getByRole('button', { name: 'Editar asunto' }));
    await user.clear(await screen.findByLabelText('Radicado oficial'));
    await user.clear(screen.getByLabelText('Título del asunto')); await user.type(screen.getByLabelText('Título del asunto'), 'Título corregido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(actualizarDatosAsuntoAPI).toHaveBeenCalledWith('asunto-1', {
      titulo: 'Título corregido', radicado_oficial: null, fecha_apertura: '2026-10-15', expected_updated_at: asunto.updated_at,
    }));
    expect(await screen.findByText('Cambios guardados')).toBeInTheDocument();
  });
});
