import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TareasAsunto } from '../TareasAsunto';
import { actualizarTarea, crearTarea, fetchMiembrosEquipo, fetchTareasAsunto } from '../../api/tareas';
import type { Tarea } from '@/types/tarea';

vi.mock('../../api/tareas', () => ({
  actualizarTarea: vi.fn(), crearTarea: vi.fn(), fetchMiembrosEquipo: vi.fn(), fetchTareasAsunto: vi.fn(),
}));
const tarea: Tarea = {
  id: 'tarea-1', tipo: 'tarea_interna', titulo: 'Solicitar certificación', instruccion: 'Pedir soporte al acreedor.',
  consecuencia: null, estado: 'pendiente', prioridad: 'normal', vence_en: null,
  asunto: { id: 'asunto-1', radicado: 'AS-1', etapa_actual: 'Evaluación', cliente: { id: 'cliente-1', nombre: 'Ana' } },
  responsable: { id: 'aux-1', nombre: 'Auxiliar' }, created_at: '2026-10-02T12:00:00Z', updated_at: '2026-10-02T12:00:00Z',
};
function prepare(canManage = true, userId = 'abogado-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  queryClient.setQueryData(['tareas', 'mi-trabajo', 'mio'], { items: [], total: 0 });
  queryClient.setQueryData(['tareas', 'agenda', 'mio'], { items: [], total: 0 });
  render(<QueryClientProvider client={queryClient}><TareasAsunto asuntoId="asunto-1" abogadoId="abogado-1" userId={userId} canManage={canManage} /></QueryClientProvider>);
  return queryClient;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchTareasAsunto).mockResolvedValue([tarea]);
  vi.mocked(fetchMiembrosEquipo).mockResolvedValue([
    { id: 'abogado-1', nombre: 'Abogado responsable', rol: 'abogado' },
    { id: 'abogado-otro', nombre: 'Otro abogado', rol: 'abogado' },
    { id: 'aux-1', nombre: 'Auxiliar', rol: 'auxiliar' },
  ]);
});

describe('TareasAsunto', () => {
  it('delega una tarea con fecha aware sin transferir el expediente ni admitir otro abogado', async () => {
    const user = userEvent.setup();
    vi.mocked(crearTarea).mockResolvedValue(tarea);
    const queryClient = prepare();
    await screen.findByText(tarea.titulo);
    await user.click(screen.getByText('Nueva tarea'));
    expect(screen.queryByRole('option', { name: 'Otro abogado' })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Título de tarea'), 'Recopilar soportes');
    await user.type(screen.getByLabelText('Instrucción de tarea'), 'Revisar la carpeta de documentos.');
    await user.selectOptions(screen.getByLabelText('Asignar a'), 'aux-1');
    fireEvent.change(screen.getByLabelText('Vencimiento de tarea'), { target: { value: '2026-10-15T09:30' } });
    await user.click(screen.getByRole('button', { name: 'Crear tarea' }));
    await waitFor(() => expect(crearTarea).toHaveBeenCalledWith({
      asunto_id: 'asunto-1', titulo: 'Recopilar soportes', instruccion: 'Revisar la carpeta de documentos.',
      responsable_id: 'aux-1', prioridad: 'normal', vence_en: new Date('2026-10-15T09:30').toISOString(),
    }));
    expect(await screen.findByText('Tarea creada')).toBeInTheDocument();
    expect(queryClient.getQueryState(['tareas', 'mi-trabajo', 'mio'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['tareas', 'agenda', 'mio'])?.isInvalidated).toBe(true);
  });

  it('el auxiliar inicia o completa su tarea manual y no recibe campos de asignación', async () => {
    const user = userEvent.setup();
    vi.mocked(actualizarTarea).mockResolvedValue({ ...tarea, estado: 'completada' });
    prepare(false, 'aux-1');
    await user.click(await screen.findByRole('button', { name: 'Completar tarea' }));
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(tarea.id, { expected_updated_at: tarea.updated_at, estado: 'completada' }));
    expect(screen.queryByText('Nueva tarea')).not.toBeInTheDocument();
    expect(screen.queryByText('Editar tarea')).not.toBeInTheDocument();
    expect(fetchMiembrosEquipo).not.toHaveBeenCalled();
  });

  it('el auxiliar no completa tareas ajenas ni pasos derivados', async () => {
    vi.mocked(fetchTareasAsunto).mockResolvedValue([tarea, { ...tarea, id: 'paso', tipo: 'completar_paso', responsable: { id: 'aux-2', nombre: 'Otra persona' } }]);
    prepare(false, 'aux-2');
    await screen.findByText('Otra persona', { exact: false });
    expect(screen.queryByRole('button', { name: 'Completar tarea' })).not.toBeInTheDocument();
  });

  it('la programación de pasos envía solo prioridad y fecha con versión', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTareasAsunto).mockResolvedValue([{ ...tarea, tipo: 'completar_paso', vence_en: '2026-10-10T12:00:00Z' }]);
    vi.mocked(actualizarTarea).mockResolvedValue(tarea);
    prepare();
    await user.click(await screen.findByText('Programar paso'));
    const row = screen.getByText(tarea.titulo).closest('li')!;
    expect(within(row).queryByLabelText('Título')).not.toBeInTheDocument();
    expect(within(row).queryByLabelText('Estado de tarea')).not.toBeInTheDocument();
    await user.selectOptions(within(row).getByLabelText('Prioridad'), 'alta');
    fireEvent.change(within(row).getByLabelText('Vencimiento'), { target: { value: '' } });
    await user.click(within(row).getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(tarea.id, { expected_updated_at: tarea.updated_at, prioridad: 'alta', vence_en: null }));
  });

  it('el responsable reabre una tarea manual completada', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTareasAsunto).mockResolvedValue([{ ...tarea, estado: 'completada' }]);
    vi.mocked(actualizarTarea).mockResolvedValue(tarea);
    prepare();
    await user.click(await screen.findByText('Editar tarea'));
    const row = screen.getByText(tarea.titulo).closest('li')!;
    await user.selectOptions(within(row).getByLabelText('Estado de tarea'), 'pendiente');
    await user.click(within(row).getByRole('button', { name: 'Guardar tarea' }));
    await waitFor(() => expect(actualizarTarea).toHaveBeenCalledWith(tarea.id, expect.objectContaining({ estado: 'pendiente', expected_updated_at: tarea.updated_at })));
  });

  it('un conflicto conserva texto y requiere confirmar para recargar la versión remota', async () => {
    const user = userEvent.setup();
    vi.mocked(actualizarTarea).mockRejectedValue({ response: { status: 409 } });
    const queryClient = prepare();
    await user.click(await screen.findByText('Editar tarea'));
    const row = screen.getByText(tarea.titulo).closest('li')!;
    const title = within(row).getByLabelText('Título');
    await user.clear(title);
    await user.type(title, 'Captura local');
    queryClient.setQueryData(['tareas', 'asunto', 'asunto-1'], [{ ...tarea, titulo: 'Otra edición', updated_at: '2026-10-02T13:00:00Z' }]);
    await user.click(within(row).getByRole('button', { name: 'Guardar tarea' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tus cambios se conservan');
    expect(title).toHaveValue('Captura local');
    expect(actualizarTarea).toHaveBeenCalledWith(tarea.id, expect.objectContaining({ titulo: 'Captura local', expected_updated_at: tarea.updated_at }));
    await user.click(screen.getByRole('button', { name: 'Recargar tarea' }));
    await user.click(screen.getByRole('button', { name: 'Conservar cambios' }));
    expect(title).toHaveValue('Captura local');
    vi.mocked(fetchTareasAsunto).mockResolvedValue([{ ...tarea, titulo: 'Guardado remoto', updated_at: '2026-10-02T14:00:00Z' }]);
    await user.click(screen.getByRole('button', { name: 'Recargar tarea' }));
    await user.click(screen.getByRole('button', { name: 'Descartar y recargar' }));
    await waitFor(() => expect(title).toHaveValue('Guardado remoto'));
  });

  it('un error de consulta ofrece reintento y nunca se presenta como lista vacía', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTareasAsunto).mockRejectedValue(new Error('offline'));
    prepare(false);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar las tareas.');
    expect(screen.queryByText('Sin tareas registradas.')).not.toBeInTheDocument();
    vi.mocked(fetchTareasAsunto).mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Reintentar tareas' }));
    expect(await screen.findByText('Sin tareas registradas.')).toBeInTheDocument();
  });
});
