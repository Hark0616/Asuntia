import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AsuntoPortalAPI } from '@/types/portal';
import { PortalCliente } from '../PortalCliente';

vi.mock('@/features/documentos/components/DocumentosTab', () => ({
  DocumentosTab: ({ asuntoId, isReadOnly }: { asuntoId: string; isReadOnly: boolean }) => {
    const [previewOpen, setPreviewOpen] = useState(false);
    return (
      <section aria-label={`Documentos ${asuntoId}`}>
        <span>{isReadOnly ? 'Documentos autorizados' : 'Documentos internos'}</span>
        <button type="button" onClick={() => setPreviewOpen(true)}>Abrir previsualización</button>
        {previewOpen && <span>Previsualización del {asuntoId}</span>}
      </section>
    );
  },
}));

function makeAsunto(overrides: Partial<AsuntoPortalAPI> = {}): AsuntoPortalAPI {
  return {
    id: 'asunto-1',
    radicado: 'AS-2026-001',
    fecha_apertura: '2026-08-01',
    responsable_nombre: 'Daniela Torres',
    ultima_novedad_at: '2026-08-03T12:00:00Z',
    novedades: [
      {
        id: 'nov-1', titulo: 'Solicitud recibida', descripcion: 'Recibimos los soportes iniciales.',
        tipo: 'nota', created_at: '2026-08-01T12:00:00Z',
      },
      {
        id: 'nov-3', titulo: 'Solicitud radicada', descripcion: 'La solicitud fue presentada ante el centro.',
        tipo: 'nota', created_at: '2026-08-03T12:00:00Z',
      },
      {
        id: 'nov-2', titulo: 'Documentos revisados', descripcion: 'La revisión inicial quedó registrada.',
        tipo: 'nota', created_at: '2026-08-02T12:00:00Z',
      },
    ],
    ...overrides,
  };
}

function renderPortal(asuntos: AsuntoPortalAPI[], selectedId = '') {
  const onSelect = vi.fn();
  render(<PortalCliente asuntos={asuntos} clienteNombre="Ana Cliente"
    selectedId={selectedId} onSelect={onSelect} />);
  return onSelect;
}

describe('PortalCliente: información autorizada', () => {
  it('destaca el avance más reciente y ordena los anteriores sin duplicarlo', () => {
    const asunto = makeAsunto();
    const originalOrder = asunto.novedades.map((avance) => avance.id);
    renderPortal([asunto]);

    const latest = screen.getByRole('region', { name: /^Último avance/ });
    expect(within(latest).getByRole('heading', { name: 'Solicitud radicada' })).toBeInTheDocument();
    expect(within(latest).getByText('La solicitud fue presentada ante el centro.')).toBeInTheDocument();
    expect(screen.getAllByText('Solicitud radicada')).toHaveLength(1);
    const history = screen.getByRole('region', { name: 'Avances anteriores' });
    expect(within(history).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent))
      .toEqual(['Documentos revisados', 'Solicitud recibida']);
    expect(within(history).queryByText('Solicitud radicada')).not.toBeInTheDocument();
    expect(asunto.novedades.map((avance) => avance.id)).toEqual(originalOrder);
    expect(screen.getByText('Daniela Torres')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('muestra ausencia de publicaciones sin inferir estado jurídico ni tareas', () => {
    renderPortal([makeAsunto({ novedades: [], ultima_novedad_at: null, responsable_nombre: null })]);

    expect(screen.getByText('Aún no hay avances publicados.')).toBeInTheDocument();
    expect(screen.getByText('Por asignar')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Avances anteriores' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Estado actual|Estado oficial|Próximo paso|Sin tareas pendientes/i)).not.toBeInTheDocument();
    expect(screen.getByText('Documentos autorizados')).toBeInTheDocument();
    expect(screen.queryByText('Documentos internos')).not.toBeInTheDocument();
  });

  it('cambia asunto, avances y documentos sin conservar la previsualización anterior', async () => {
    const user = userEvent.setup();
    const asuntos = [makeAsunto(), makeAsunto({
      id: 'asunto-2', radicado: 'AS-2026-002', responsable_nombre: 'Pedro López',
      novedades: [{ id: 'nov-otro', titulo: 'Audiencia comunicada',
        descripcion: 'La firma confirmó los datos de la audiencia.', tipo: 'nota', created_at: '2026-08-04T15:00:00Z' }],
    })];
    function SelectablePortal() {
      const [selectedId, setSelectedId] = useState('asunto-1');
      return <PortalCliente asuntos={asuntos} clienteNombre="Ana Cliente"
        selectedId={selectedId} onSelect={setSelectedId} />;
    }
    render(<SelectablePortal />);

    await user.click(screen.getByRole('button', { name: 'Abrir previsualización' }));
    expect(screen.getByText('Previsualización del asunto-1')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Consultar asunto'), 'asunto-2');

    expect(screen.getByRole('heading', { name: 'Audiencia comunicada' })).toBeInTheDocument();
    expect(screen.getByText('Pedro López')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documentos asunto-2' })).toBeInTheDocument();
    expect(screen.queryByText('Solicitud radicada')).not.toBeInTheDocument();
    expect(screen.queryByText('Previsualización del asunto-1')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Documentos asunto-1' })).not.toBeInTheDocument();
  });

  it('elige el primer asunto cuando el identificador anterior dejó de estar disponible', () => {
    renderPortal([makeAsunto()], 'asunto-retirado');

    expect(screen.getByText('AS-2026-001')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solicitud radicada' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Documentos asunto-1' })).toBeInTheDocument();
  });

  it('presenta un vacío confirmado sin documentos ni publicaciones inventadas', () => {
    renderPortal([]);

    expect(screen.getByRole('heading', { name: 'Sin asuntos disponibles' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Documentos autorizados')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Último avance' })).not.toBeInTheDocument();
  });
});
