import { render, screen } from '@testing-library/react';
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
        clientes={[
          { id: 'cliente-1', nombre: 'Carlos Gómez' },
          { id: 'cliente-2', nombre: 'María Elena' },
        ]}
        clienteSeleccionadoId="cliente-2"
        onSubmit={onSubmit}
      />,
    );

    const radicado = screen.getByLabelText(/Número de Radicado/i);
    await user.clear(radicado);
    await user.type(radicado, 'AS-2026-010');
    await user.click(screen.getByRole('button', { name: /Crear Expediente/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        radicado: 'AS-2026-010',
        cliente_id: 'cliente-2',
      }),
    );
  });
});
