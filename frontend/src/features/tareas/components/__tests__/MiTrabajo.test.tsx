import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import { fetchMiTrabajo } from '../../api/tareas';
import { MiTrabajo } from '../MiTrabajo';

vi.mock('../../api/tareas', () => ({
  fetchMiTrabajo: vi.fn(),
}));

const mockedFetchMiTrabajo = vi.mocked(fetchMiTrabajo);

function renderWork(isAdmin = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MiTrabajo isAdmin={isAdmin} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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
    expect(screen.getByText('Completar recepción y evaluación inicial')).toBeInTheDocument();
    const link = screen.getByRole('link', {
      name: /Abrir AS-2026-001.*recepción/i,
    });
    expect(link).toHaveAttribute('href', '/oficina/asuntos/asunto-1');
    await user.click(link);
  });

  it('permite a administración consultar el trabajo del equipo', async () => {
    const user = userEvent.setup();
    mockedFetchMiTrabajo.mockResolvedValue({ total: 0, items: [] });
    renderWork();

    await screen.findByText('Sin tareas pendientes');
    await user.click(screen.getByRole('button', { name: 'Equipo' }));
    expect(mockedFetchMiTrabajo).toHaveBeenLastCalledWith('equipo');
  });

  it('oculta el alcance de equipo para abogados', async () => {
    mockedFetchMiTrabajo.mockResolvedValue({ total: 0, items: [] });
    renderWork(false);

    await screen.findByText('Sin tareas pendientes');
    expect(screen.queryByRole('button', { name: 'Equipo' })).not.toBeInTheDocument();
  });
});
