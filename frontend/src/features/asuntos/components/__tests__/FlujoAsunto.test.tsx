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
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Radicado oficial/), {
      target: { value: 'RAD-2026-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Completar y continuar/ }));

    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledWith('radicacion', {
        radicado_oficial: 'RAD-2026-001',
      });
    });
  });
});
