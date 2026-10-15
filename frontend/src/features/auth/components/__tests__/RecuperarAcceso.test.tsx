import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecuperarAcceso } from '../RecuperarAcceso';
import { restablecerPasswordAPI, solicitarRecuperacionAPI } from '../../api/auth';

vi.mock('../../api/auth', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/auth')>(),
  restablecerPasswordAPI: vi.fn(), solicitarRecuperacionAPI: vi.fn(),
}));

const challenge = '00000000-0000-0000-0000-000000000099';
const token = 'a'.repeat(43);
const hash = `#challenge=${challenge}&token=${token}`;

function show(fragment = '') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['privado', 'asuntos'], ['dato anterior']);
  render(<QueryClientProvider client={client}><MemoryRouter>
    <RecuperarAcceso search="?firma=firma-real" hash={fragment} />
  </MemoryRouter></QueryClientProvider>);
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(solicitarRecuperacionAPI).mockResolvedValue({ message: 'Si los datos coinciden, enviaremos un enlace', expires_in_seconds: 900 });
  vi.mocked(restablecerPasswordAPI).mockResolvedValue(undefined);
});

describe('Recuperación de acceso', () => {
  it('solicita el enlace con la firma y muestra el vencimiento recibido', async () => {
    show();
    expect(screen.getByLabelText('Firma')).toHaveValue('firma-real');
    fireEvent.change(screen.getByLabelText('Correo de la oficina'), { target: { value: 'office@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar enlace' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Revisa tu correo');
    expect(screen.getByText('El enlace vence en 15 min.')).toBeInTheDocument();
    expect(solicitarRecuperacionAPI).toHaveBeenCalledWith('firma-real', 'office@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar otro enlace' }));
    expect(await screen.findByLabelText('Correo de la oficina')).toHaveValue('office@example.com');
  });

  it('valida confirmación, consume el enlace y limpia la sesión anterior', async () => {
    const client = show(hash);
    fireEvent.change(screen.getByLabelText('Nueva contraseña'), { target: { value: 'Password-prueba-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Diferente-prueba!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(restablecerPasswordAPI).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Password-prueba-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Contraseña actualizada');
    expect(restablecerPasswordAPI).toHaveBeenCalledWith({ firma_slug: 'firma-real', challenge_id: challenge,
      token, password: 'Password-prueba-2026!' }, expect.anything());
    expect(client.getQueryData(['privado', 'asuntos'])).toBeUndefined();
    expect(client.getQueryData(['auth', 'me'])).toBeNull();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/?firma=firma-real');
  });

  it('no manda enlaces incompletos al servidor', () => {
    show('#challenge=bad');
    expect(screen.getByRole('alert')).toHaveTextContent('Enlace incompleto');
    expect(screen.queryByLabelText('Nueva contraseña')).not.toBeInTheDocument();
    expect(restablecerPasswordAPI).not.toHaveBeenCalled();
  });

  it('conserva el formulario y muestra el tiempo de espera ante 429', async () => {
    vi.mocked(solicitarRecuperacionAPI).mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '120' } } });
    show();
    fireEvent.change(screen.getByLabelText('Correo de la oficina'), { target: { value: 'office@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar enlace' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Reintenta en 2 min.');
    expect(screen.getByLabelText('Correo de la oficina')).toHaveValue('office@example.com');
  });

  it('muestra vencimiento sin reenviar el restablecimiento', async () => {
    vi.mocked(restablecerPasswordAPI).mockRejectedValue({ response: { data: { detail: 'Enlace inválido o vencido' } } });
    show(hash);
    for (const label of ['Nueva contraseña', 'Confirmar contraseña']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Password-prueba-2026!' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enlace inválido o vencido');
    await waitFor(() => expect(restablecerPasswordAPI).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('link', { name: 'Solicitar otro enlace' })).toBeInTheDocument();
  });
});
