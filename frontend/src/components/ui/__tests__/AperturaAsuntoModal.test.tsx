import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AperturaAsuntoModal } from '../AperturaAsuntoModal';

const clientes = [
  {
    id: 'cliente-1',
    tipo_persona: 'natural' as const,
    tipo_documento: 'CC' as const,
    numero_documento: '52.123.456',
    cedula: '52.123.456',
    nombre: 'María Elena Pérez',
    email: 'maria@example.com',
    telefono: '3001234567',
    ciudad: 'Bucaramanga',
    departamento: 'Santander',
    canal_preferido: 'whatsapp' as const,
    asuntos_count: 1,
    rol: 'cliente',
    created_at: '2026-07-29T12:00:00Z',
  },
  {
    id: 'cliente-2',
    tipo_persona: 'juridica' as const,
    tipo_documento: 'NIT' as const,
    numero_documento: '901.555.123-4',
    cedula: '901.555.123-4',
    nombre: 'Comercializadora del Oriente S.A.S.',
    email: 'contacto@oriente.example.com',
    canal_preferido: 'email' as const,
    asuntos_count: 2,
    rol: 'cliente',
    created_at: '2026-07-29T12:00:00Z',
  },
];

const responsables = [
  {
    id: 'admin-1',
    nombre: 'Dra. Daniela Torres',
    rol: 'administrador' as const,
  },
  {
    id: 'abogado-1',
    nombre: 'Dr. Alejandro Morales',
    rol: 'abogado' as const,
  },
];

const currentUser = {
  id: 'admin-1',
  nombre: 'Dra. Daniela Torres',
  email: 'daniela@asuntia.com',
  cedula: '52.840.192',
  rol: 'administrador' as const,
  firma_id: 'firma-1',
};

describe('apertura de asuntos', () => {
  it('muestra primero el directorio y abre el asunto para el cliente seleccionado', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AperturaAsuntoModal
        isOpen
        clientes={clientes}
        responsables={responsables}
        usuarioActual={currentUser}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole('tab', { name: /Directorio de clientes/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('María Elena Pérez')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: /52\.123\.456/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('radio', { name: /María Elena Pérez/i }),
    );
    fireEvent.change(screen.getByLabelText(/Fecha de apertura/i), {
      target: { value: '2026-07-15' },
    });
    await user.click(screen.getByRole('button', { name: 'Abrir asunto' }));

    expect(onSubmit).toHaveBeenCalledWith({
      cliente_id: 'cliente-1',
      abogado_id: 'admin-1',
      fecha_apertura: '2026-07-15',
    });
  });

  it('registra un perfil completo y lo vincula al nuevo asunto', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <AperturaAsuntoModal
        isOpen
        clientes={clientes}
        responsables={responsables}
        usuarioActual={currentUser}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /Cliente nuevo/i }));
    await user.selectOptions(
      screen.getByLabelText(/Tipo de persona/i),
      'juridica',
    );
    await user.type(
      screen.getByLabelText(/Número de identificación/i),
      '901.888.765-2',
    );
    await user.type(
      screen.getByLabelText(/Nombre legal o razón social/i),
      'Logística Andina S.A.S.',
    );
    await user.type(
      screen.getByLabelText(/Correo electrónico/i),
      'legal@logisticaandina.com',
    );
    await user.type(
      screen.getByLabelText(/Teléfono o WhatsApp/i),
      '3155550182',
    );
    await user.type(
      screen.getByLabelText(/Ciudad/i),
      'Floridablanca',
    );
    await user.type(
      screen.getByLabelText(/Departamento/i),
      'Santander',
    );
    await user.selectOptions(
      screen.getByLabelText(/Canal preferido/i),
      'whatsapp',
    );
    await user.type(
      screen.getByLabelText(/Dirección de residencia o sede/i),
      'Calle 10 # 20-30',
    );
    await user.click(screen.getByRole('button', { name: 'Abrir asunto' }));

    expect(onSubmit).toHaveBeenCalledWith({
      cliente_nuevo: expect.objectContaining({
        tipo_persona: 'juridica',
        tipo_documento: 'NIT',
        numero_documento: '901.888.765-2',
        nombre: 'Logística Andina S.A.S.',
        email: 'legal@logisticaandina.com',
        telefono: '3155550182',
        ciudad: 'Floridablanca',
        departamento: 'Santander',
        canal_preferido: 'whatsapp',
        direccion: 'Calle 10 # 20-30',
      }),
      abogado_id: 'admin-1',
      fecha_apertura: expect.any(String),
    });
  });
});
