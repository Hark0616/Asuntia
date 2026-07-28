import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OficinaLogin } from '../OficinaLogin';

vi.mock('@/features/auth/api/auth', () => ({
  loginOficinaAPI: vi.fn().mockResolvedValue({
    id: 'user-1',
    nombre: 'Dra. Daniela Torres',
    email: 'daniela.torres@asuntia.com',
    cedula: '52.840.192',
    rol: 'administrador',
    firma_id: 'firma-1',
  }),
}));

describe('OficinaLogin Component', () => {
  it('debe renderizar el formulario de login de la oficina', () => {
    const onSuccessMock = vi.fn();
    render(<OficinaLogin onSuccess={onSuccessMock} />);

    expect(screen.getByText('Acceso a Oficina')).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Institucional/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i)).toBeInTheDocument();
  });

  it('debe enviar el formulario de oficina y llamar onSuccess', async () => {
    const onSuccessMock = vi.fn();
    render(<OficinaLogin onSuccess={onSuccessMock} />);

    const submitBtn = screen.getByRole('button', { name: /Ingresar a Tablero/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSuccessMock).toHaveBeenCalledWith(expect.objectContaining({
        email: 'daniela.torres@asuntia.com',
        rol: 'administrador'
      }));
    });
  });
});
