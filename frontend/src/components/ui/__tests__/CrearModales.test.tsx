import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CrearAsuntoModal } from '../CrearAsuntoModal';
import { CrearClienteModal } from '../CrearClienteModal';

describe('flujos de creación de oficina', () => {
  it('envía todos los datos del nuevo cliente', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CrearClienteModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText(/Nombre Completo/i), '  Ana Pérez  ');
    await user.type(screen.getByLabelText(/Cédula o NIT/i), '  52.123.456  ');
    await user.type(screen.getByLabelText(/Teléfono/i), '3001234567');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'ana@example.com');
    await user.click(screen.getByRole('button', { name: /Registrar Cliente/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      cedula: '52.123.456',
      email: 'ana@example.com',
      telefono: '3001234567',
    });
  });

  it('crea el expediente para el cliente seleccionado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CrearAsuntoModal
        isOpen
        onClose={vi.fn()}
        cliente={{ id: 'cliente-2', nombre: 'María Elena' }}
        responsableNombre="Ana Abogada"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.queryByLabelText(/Número de Radicado/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cliente Asignado/i)).not.toBeInTheDocument();
    expect(screen.getByText('María Elena')).toBeInTheDocument();
    expect(screen.getByText(/Responsable inicial.*Ana Abogada/i)).toBeInTheDocument();
    expect(screen.getByText(/Paso 1.*Recepción y evaluación inicial/i)).toBeInTheDocument();
    expect(screen.getByText(/Se asignará como tarea a Ana Abogada/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Fecha de apertura/i), {
      target: { value: '2026-07-15' },
    });
    await user.click(screen.getByRole('button', { name: /Crear expediente/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      cliente_id: 'cliente-2',
      fecha_apertura: '2026-07-15',
    });
  });

});
