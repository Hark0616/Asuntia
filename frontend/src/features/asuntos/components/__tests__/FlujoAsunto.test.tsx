import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FlujoAsunto } from '../FlujoAsunto';
import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';


const pasos: AsuntoPasoAPI[] = [
  {
    id: 'paso-1',
    orden: 1,
    codigo: 'radicacion',
    titulo: 'Radicación',
    descripcion: 'Registra la radicación oficial.',
    estado: 'activo',
    campos: [
      {
        clave: 'radicado_oficial',
        etiqueta: 'Radicado oficial',
        tipo: 'text',
        requerido: true,
        opciones: [],
      },
      {
        clave: 'fecha_radicacion',
        etiqueta: 'Fecha de radicación',
        tipo: 'date',
        requerido: true,
        opciones: [],
      },
    ],
    datos: {},
  },
  {
    id: 'paso-2',
    orden: 2,
    codigo: 'agendar_audiencia',
    titulo: 'Agendar audiencia',
    descripcion: 'Define la audiencia.',
    estado: 'bloqueado',
    campos: [],
    datos: {},
  },
];


describe('FlujoAsunto', () => {
  it('muestra el paso activo y envía sus datos', async () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        onAdvance={onAdvance}
      />,
    );

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Agendar audiencia')).toBeInTheDocument();
    expect(screen.getByText('Siguiente')).toBeInTheDocument();
    const actionHeading = screen.getByText('Acción actual');
    const routeHeading = screen.getByText('Ruta completa');
    expect(
      actionHeading.compareDocumentPosition(routeHeading)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const activeStepSummary = screen.getByText('Paso 1', { selector: 'small' }).closest('summary');
    expect(activeStepSummary).toHaveAttribute('aria-current', 'step');

    fireEvent.change(screen.getByLabelText(/Radicado oficial/), {
      target: { value: 'RAD-2026-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Usar hoy' }));
    const filingDate = screen.getByLabelText(/Fecha de radicación/) as HTMLInputElement;
    expect(filingDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.click(screen.getByRole('button', { name: /Completar y continuar/ }));

    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledWith('radicacion', {
        radicado_oficial: 'RAD-2026-001',
        fecha_radicacion: filingDate.value,
      });
    });
  });

  it('permite consultar la descripción de una etapa futura sin habilitarla', () => {
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        onAdvance={vi.fn()}
      />,
    );

    const futureSummary = screen.getByText('Agendar audiencia').closest('summary');
    const futureDetails = futureSummary?.closest('details');
    expect(futureDetails).not.toHaveAttribute('open');

    fireEvent.click(futureSummary!);
    expect(futureDetails).toHaveAttribute('open');
    expect(screen.getByText('Define la audiencia.')).toBeInTheDocument();
  });

  it('muestra la ruta sin controles de avance cuando el rol es de consulta', () => {
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        canAdvance={false}
        onAdvance={vi.fn()}
      />,
    );

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getAllByText('Registra la radicación oficial.')).toHaveLength(2);
    expect(screen.getByText('Este paso está asignado a otro responsable.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Radicado oficial/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Completar/ })).not.toBeInTheDocument();
  });
});
