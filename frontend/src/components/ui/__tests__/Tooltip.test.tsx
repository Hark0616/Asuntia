import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { fetchMiTrabajo } from '@/features/tareas/api/tareas';
import { MiTrabajo } from '@/features/tareas/components/MiTrabajo';
import { Tooltip } from '../Tooltip';

const content = 'Solo se publica información autorizada por la firma.';

vi.mock('@/features/tareas/api/tareas', () => ({ fetchMiTrabajo: vi.fn() }));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="Ruta actual">{location.pathname}</output>;
}

describe('Tooltip', () => {
  it('abre con foco y relaciona el contexto con el botón', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={content} />);
    const trigger = screen.getByRole('button', { name: 'Más información' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAccessibleDescription(content);
    expect(trigger).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
  });

  it('cierra con Escape conservando el foco y permite reabrir con Enter', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={content} />);
    await user.tab();
    const trigger = screen.getByRole('button', { name: 'Más información' });

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('aria-describedby');

    await user.keyboard('{Enter}');
    expect(screen.getByRole('tooltip')).toHaveTextContent(content);
    expect(trigger).toHaveFocus();
  });

  it('permite abrir y cerrar con Espacio sin enviar el formulario', async () => {
    const user = userEvent.setup();
    render(<form><Tooltip content={content} /></form>);
    await user.tab();
    await user.keyboard('{Escape}');

    await user.keyboard(' ');
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Más información' })).toHaveAttribute('type', 'button');
    await user.keyboard(' ');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('retira la ayuda al pasar el foco al control siguiente', async () => {
    const user = userEvent.setup();
    render(<><Tooltip content={content} /><button type="button">Continuar</button></>);
    await user.tab();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveFocus();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('abre y cierra con tap sin necesitar hover', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={content} />);
    const trigger = screen.getByRole('button', { name: 'Más información' });

    await user.pointer([{ keys: '[TouchA>]', target: trigger }, { keys: '[/TouchA]' }]);
    expect(screen.getByRole('tooltip')).toHaveTextContent(content);
    await user.pointer([{ keys: '[TouchA>]', target: trigger }, { keys: '[/TouchA]' }]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('permite cerrar la ayuda tocando fuera del control', async () => {
    const user = userEvent.setup();
    render(<><Tooltip content={content} /><p>Expediente</p></>);
    const trigger = screen.getByRole('button', { name: 'Más información' });
    await user.pointer([{ keys: '[TouchA>]', target: trigger }, { keys: '[/TouchA]' }]);

    await user.pointer([
      { keys: '[TouchA>]', target: screen.getByText('Expediente') },
      { keys: '[/TouchA]' },
    ]);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('conserva la ayuda mientras se mueve el puntero desde el icono al contenido', async () => {
    const user = userEvent.setup();
    render(<Tooltip content={content} />);
    const trigger = screen.getByRole('button', { name: 'Más información' });
    await user.hover(trigger);
    const popup = screen.getByRole('tooltip');
    await user.hover(popup);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await user.unhover(popup);
    await waitFor(() => expect(screen.queryByRole('tooltip')).not.toBeInTheDocument());
  });

  it('no activa el summary que contiene el icono', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <details>
        <summary>Corrección administrativa <Tooltip content={content} /></summary>
        <p>Editar estado</p>
      </details>,
    );

    await user.click(screen.getByRole('button', { name: 'Más información' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent(content);
    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });

  it('mantiene identificadores únicos para cada ayuda', async () => {
    const user = userEvent.setup();
    render(<><Tooltip content="Contexto del estado" /><Tooltip content="Contexto del documento" /></>);
    const triggers = screen.getAllByRole('button', { name: 'Más información' });
    await user.tab();
    await user.hover(triggers[1]);
    const descriptions = triggers.map((trigger) => trigger.getAttribute('aria-describedby'));
    expect(descriptions[0]).toBeTruthy();
    expect(descriptions[1]).toBeTruthy();
    expect(descriptions[0]).not.toEqual(descriptions[1]);
  });

  it('muestra el contexto de la tarea sin anidar controles ni navegar al expediente', async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMiTrabajo).mockResolvedValue({
      total: 1,
      items: [{
        id: 'tarea-1',
        tipo: 'completar_paso',
        titulo: 'Revisar recepción',
        instruccion: 'Verifica los documentos.',
        consecuencia: content,
        estado: 'pendiente',
        prioridad: 'normal',
        vence_en: null,
        asunto: {
          id: 'asunto-1', radicado: 'AS-2026-001', etapa_actual: 'Recepción',
          cliente: { id: 'cliente-1', nombre: 'Carlos Gómez' },
        },
        responsable: { id: 'abogada-1', nombre: 'Daniela Torres' },
        created_at: '2026-07-28T10:00:00Z',
        updated_at: '2026-07-28T10:00:00Z',
      }],
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/oficina/trabajo']}>
          <MiTrabajo isAdmin={false} />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const link = await screen.findByRole('link', { name: 'Abrir AS-2026-001: Revisar recepción' });
    const trigger = screen.getByRole('button', { name: 'Más información' });
    expect(link.contains(trigger)).toBe(false);

    await user.click(trigger);
    expect(screen.getByRole('tooltip')).toHaveTextContent(content);
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/oficina/trabajo');

    await user.click(link);
    expect(screen.getByLabelText('Ruta actual')).toHaveTextContent('/oficina/asuntos/asunto-1');
  });
});
