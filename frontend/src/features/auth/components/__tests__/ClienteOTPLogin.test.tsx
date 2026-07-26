import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClienteOTPLogin } from '../ClienteOTPLogin';

// Mock de apiClient
vi.mock('@/lib/axios', () => ({
  apiClient: {
    post: vi.fn((url: string, body: any) => {
      if (url === '/auth/otp/request') {
        if (body.cedula === '1.094.852.140') {
          return Promise.resolve({ data: { message: 'Código OTP enviado' } });
        }
        return Promise.reject({ response: { data: { detail: 'Cédula no encontrada' } } });
      }
      if (url === '/auth/otp/verify') {
        if (body.code === '123456') {
          return Promise.resolve({
            data: { user: { nombre: 'Carlos Gómez', rol: 'cliente' } }
          });
        }
        return Promise.reject({ response: { data: { detail: 'Código incorrecto' } } });
      }
      return Promise.reject(new Error('URL no encontrada'));
    })
  }
}));

describe('ClienteOTPLogin Component', () => {
  it('debe renderizar el paso 1 de cédula correctamente', () => {
    const onSuccessMock = vi.fn();
    render(<ClienteOTPLogin onSuccess={onSuccessMock} />);

    expect(screen.getByText('Consulta de Expediente')).toBeInTheDocument();
    expect(screen.getByLabelText(/Cédula de ciudadanía/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuar/i })).toBeInTheDocument();
  });

  it('debe avanzar al paso 2 de verificación OTP tras solicitar el código', async () => {
    const onSuccessMock = vi.fn();
    render(<ClienteOTPLogin onSuccess={onSuccessMock} />);

    const button = screen.getByRole('button', { name: /Continuar/i });
    fireEvent.click(button);

    // Esperar mensaje del paso 2
    const otpInput = await screen.findByLabelText(/Código de seguridad/i);
    expect(otpInput).toBeInTheDocument();
  });

  it('[CASO BORDE / ERROR] debe mostrar mensaje de error cuando falla la solicitud', async () => {
    const onSuccessMock = vi.fn();
    render(<ClienteOTPLogin onSuccess={onSuccessMock} />);

    const cedulaInput = screen.getByLabelText(/Cédula de ciudadanía/i);
    fireEvent.change(cedulaInput, { target: { value: '00000000' } });

    const button = screen.getByRole('button', { name: /Continuar/i });
    fireEvent.click(button);

    const errorMessage = await screen.findByText('Cédula no encontrada');
    expect(errorMessage).toBeInTheDocument();
  });
});
