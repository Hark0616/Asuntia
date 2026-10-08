import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { fetchAgenda, fetchMiTrabajo } from '../../api/tareas';
import { MiTrabajo } from '../MiTrabajo';

vi.mock('../../api/tareas', () => ({
  fetchMiTrabajo: vi.fn(),
  fetchAgenda: vi.fn(),
}));

const mockedFetchMiTrabajo = vi.mocked(fetchMiTrabajo);

function renderWork(isAdmin = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MiTrabajo isAdmin={isAdmin} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMiTrabajo).mockResolvedValue({ items: [], total: 0 });
  vi.mocked(fetchAgenda).mockResolvedValue({ items: [], total: 0 });
});

describe('MiTrabajo', () => {
  it('muestra trabajo real y abre el expediente seleccionado', async () => {
    const user = userEvent.setup();
    mockedFetchMiTrabajo.mockResolvedValue({
      total: 1,
      items: [{
        id: 'tarea-1',
        tipo: 'completar_paso',
        titulo: 'Completar recepción y evaluación inicial',
        instruccion: 'Verifica identidad y viabilidad preliminar.',
        consecuencia: null,
        estado: 'pendiente',
        prioridad: 'normal',
        vence_en: null,
        asunto: {
          id: 'asunto-1',
          radicado: 'AS-2026-001',
          etapa_actual: 'Paso 1 de 7',
          cliente: { id: 'cliente-1', nombre: 'Carlos Gómez' },
        },
        responsable: { id: 'abogada-1', nombre: 'Daniela Torres' },
        created_at: '2026-07-28T10:00:00Z',
        updated_at: '2026-07-28T10:00:00Z',
      }],
    });
    renderWork();

    expect(await screen.findByText('Carlos Gómez')).toBeInTheDocument();
    expect(screen.getByText('1 pendiente asignado a ti.')).toBeInTheDocument();
    expect(screen.getByText('Completar recepción y evaluación inicial')).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: /Abrir AS-2026-001.*recepción/i,
    });
    expect(link).toHaveAttribute(
      'href',
      '/oficina/asuntos/asunto-1#paso-activo',
    );
    await user.click(link);
  });

  it('permite a administración consultar el trabajo del equipo', async () => {
    const user = userEvent.setup();
    mockedFetchMiTrabajo.mockResolvedValue({ total: 0, items: [] });
    renderWork();

    await screen.findByText('Sin tareas pendientes');
    await user.click(screen.getByRole('button', { name: 'Equipo' }));
    expect(mockedFetchMiTrabajo).toHaveBeenLastCalledWith('equipo');
    expect(await screen.findByText('0 pendientes del equipo.')).toBeInTheDocument();
  });

  it('oculta el alcance de equipo para abogados', async () => {
    mockedFetchMiTrabajo.mockResolvedValue({ total: 0, items: [] });
    renderWork(false);

    await screen.findByText('Sin tareas pendientes');
    expect(screen.queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument();
  });

  it('agenda deriva audiencias y vencimientos, conserva alcance y abre su expediente', async () => {
    const user = userEvent.setup();
    const asunto = { id: 'asunto-1', radicado: 'AS-1', etapa_actual: 'Audiencia', cliente: { id: 'cliente-1', nombre: 'Ana' } };
    const responsable = { id: 'aux-1', nombre: 'Auxiliar' };
    vi.mocked(fetchAgenda).mockResolvedValue({ total: 2, items: [
      { id: 'audiencia-1', origen: 'audiencia', titulo: 'Audiencia registrada', fecha: '2026-10-10T12:00:00Z', asunto, responsable },
      { id: 'task-1', origen: 'tarea', titulo: 'Preparar soportes', fecha: '2026-10-09T12:00:00Z', asunto, responsable },
    ] });
    renderWork();
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    expect(await screen.findByText('Audiencia registrada')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Abrir AS-1: Audiencia registrada/ })).toHaveAttribute('href', '/oficina/asuntos/asunto-1#paso-activo');
    expect(screen.getByRole('link', { name: /Abrir AS-1: Preparar soportes/ })).toHaveAttribute('href', '/oficina/asuntos/asunto-1#tareas-expediente');
    await user.click(screen.getByRole('button', { name: 'Equipo' }));
    await waitFor(() => expect(fetchAgenda).toHaveBeenLastCalledWith('equipo', expect.stringMatching(/Z$/), expect.stringMatching(/Z$/)));
  });

  it('el intervalo incluye el día final y bloquea rangos invertidos o mayores a92 días', async () => {
    const user = userEvent.setup();
    renderWork(false);
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    await screen.findByText('Sin fechas en este intervalo');
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-10-02' } });
    await waitFor(() => expect(fetchAgenda).toHaveBeenLastCalledWith('mio', new Date('2026-10-01T00:00:00').toISOString(), new Date('2026-10-03T00:00:00').toISOString()));
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un intervalo');
    expect(screen.getByRole('button', { name: 'Actualizar agenda' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2027-03-01' } });
    expect(screen.getByRole('alert')).toHaveTextContent('92 días');
  });

  it('un fallo de agenda ofrece reintento sin afirmar que no existen fechas', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchAgenda).mockRejectedValue(new Error('offline'));
    renderWork(false);
    await user.click(screen.getByRole('button', { name: 'Agenda' }));
    expect(await screen.findByText('No pudimos consultar la agenda')).toBeInTheDocument();
    expect(screen.queryByText('Sin fechas en este intervalo')).not.toBeInTheDocument();
    vi.mocked(fetchAgenda).mockResolvedValue({ items: [], total: 0 });
    await user.click(screen.getByRole('button', { name: 'Reintentar agenda' }));
    expect(await screen.findByText('Sin fechas en este intervalo')).toBeInTheDocument();
  });
});
