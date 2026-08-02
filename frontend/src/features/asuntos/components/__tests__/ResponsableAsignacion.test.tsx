import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ResponsableAsignacion } from '../ResponsableAsignacion';


const responsables = [
  {
    id: 'admin-1',
    nombre: 'Dra. Daniela Torres',
    rol: 'administrador' as const,
  },
  {
    id: 'lawyer-1',
    nombre: 'Dr. Alejandro Morales',
    rol: 'abogado' as const,
  },
];


describe('ResponsableAsignacion', () => {
  it('permite cambiar el responsable cuando el rol administra asignaciones', () => {
    const onChange = vi.fn();
    render(
      <ResponsableAsignacion
        id="client-responsible"
        label="Responsable del cliente"
        value="admin-1"
        responsables={responsables}
        canEdit
        onChange={onChange}
      />,
    );

    fireEvent.change(
      screen.getByLabelText('Responsable del cliente'),
      { target: { value: 'lawyer-1' } },
    );

    expect(onChange).toHaveBeenCalledWith('lawyer-1');
  });

  it('muestra el responsable sin control editable a un abogado regular', () => {
    render(
      <ResponsableAsignacion
        id="case-responsible"
        label="Abogado del asunto"
        value="lawyer-1"
        responsables={responsables}
        canEdit={false}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Dr. Alejandro Morales')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
