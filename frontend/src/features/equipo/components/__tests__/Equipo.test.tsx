import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GestionEquipo } from '../GestionEquipo';
import { ActivarEquipo } from '../ActivarEquipo';
import { activarMiembro, cambiarRol, consultarEquipo, invitarMiembro, retirarAcceso } from '../../api/equipo';
import type { MiembroEquipo } from '@/types/equipo';

vi.mock('../../api/equipo', async importOriginal => ({
  ...await importOriginal<typeof import('../../api/equipo')>(),
  consultarEquipo: vi.fn(), invitarMiembro: vi.fn(), renovarInvitacion: vi.fn(),
  cambiarRol: vi.fn(), retirarAcceso: vi.fn(), activarMiembro: vi.fn(),
}));

const admin: MiembroEquipo = { id: 'admin', nombre: 'Daniela', email: 'admin@example.com', cedula: '123',
  rol: 'administrador', estado: 'activo', updated_at: '2026-10-14T10:00:00Z',
  clientes: 0, asuntos: 0, tareas_pendientes: 0, tareas_fuera_de_asuntos: 0 };
const worker: MiembroEquipo = { ...admin, id: 'worker', nombre: 'Alejandro', email: 'worker@example.com',
  rol: 'abogado', clientes: 1, asuntos: 2, tareas_pendientes: 3 };
const invitation = { miembro: worker, firma_slug: 'firma-real',
  invitacion_id: '00000000-0000-0000-0000-000000000099', token: 'a'.repeat(43), expires_at: '2026-10-15T10:00:00Z' };

function show(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(consultarEquipo).mockResolvedValue([admin, worker]);
  vi.mocked(retirarAcceso).mockResolvedValue({ ...worker, estado: 'inactivo' });
  vi.mocked(cambiarRol).mockResolvedValue({ ...worker, rol: 'auxiliar' });
  vi.mocked(invitarMiembro).mockResolvedValue(invitation);
  vi.mocked(activarMiembro).mockResolvedValue(undefined);
});

describe('Gestión de equipo', () => {
  it('muestra equipo, carga pendiente y controles ajenos', async () => {
    show(<GestionEquipo currentUserId="admin" />);
    expect(await screen.findByText('Alejandro')).toBeInTheDocument();
    expect(screen.getByText('1 clientes · 2 asuntos · 3 tareas pendientes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cambiar rol' })).toHaveLength(1);
    expect(screen.getByText('Administrador · Activo · Tú')).toBeInTheDocument();
  });

  it('crea una invitación y muestra el enlace para compartir', async () => {
    show(<GestionEquipo currentUserId="admin" />);
    fireEvent.click(screen.getByRole('button', { name: 'Invitar miembro' }));
    for (const [label, value] of [['Nombre', 'Alejandro'], ['Correo', 'worker@example.com'], ['Documento', '456']]) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Crear invitación' }));
    const link = await screen.findByLabelText('Enlace de activación');
    expect((link as HTMLInputElement).value).toContain('/activar-equipo?firma=firma-real#invitacion=');
    expect(invitarMiembro).toHaveBeenCalledWith({ nombre: 'Alejandro', email: 'worker@example.com', cedula: '456', rol: 'abogado' }, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar enlace' }));
    expect(screen.queryByLabelText('Enlace de activación')).not.toBeInTheDocument();
  });

  it('solicita reemplazo y manda la versión al retirar acceso', async () => {
    show(<GestionEquipo currentUserId="admin" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Retirar acceso' }));
    const form = screen.getByRole('form', { name: 'Modificar acceso de Alejandro' });
    const replacement = within(form).getByRole('combobox');
    expect(replacement).toBeRequired();
    fireEvent.change(replacement, { target: { value: 'admin' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Confirmar retiro de acceso' }));
    await waitFor(() => expect(retirarAcceso).toHaveBeenCalledWith({
      id: 'worker', expected_updated_at: worker.updated_at, reasignar_a_id: 'admin',
    }, expect.anything()));
  });

  it('exige transferencia al pasar de abogado a auxiliar', async () => {
    show(<GestionEquipo currentUserId="admin" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar rol' }));
    fireEvent.change(screen.getByLabelText('Nuevo rol'), { target: { value: 'auxiliar' } });
    const form = screen.getByRole('form', { name: 'Modificar acceso de Alejandro' });
    fireEvent.change(within(form).getByLabelText(/Reasignar trabajo/), { target: { value: 'admin' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Guardar rol' }));
    await waitFor(() => expect(cambiarRol).toHaveBeenCalledWith({ id: 'worker',
      expected_updated_at: worker.updated_at, rol: 'auxiliar', reasignar_a_id: 'admin' }, expect.anything()));
  });

  it('permite reintentar si falla la consulta', async () => {
    vi.mocked(consultarEquipo).mockRejectedValueOnce(new Error('offline'));
    show(<GestionEquipo currentUserId="admin" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo consultar el equipo');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Alejandro')).toBeInTheDocument();
  });

  it('recarga el equipo para recuperar invitaciones cuyo resultado no llegó', async () => {
    show(<GestionEquipo currentUserId="admin" />);
    expect(await screen.findByText('Alejandro')).toBeInTheDocument();
    vi.mocked(consultarEquipo).mockResolvedValue([admin, { ...worker, estado: 'invitado' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    expect(await screen.findByRole('button', { name: 'Generar enlace' })).toBeInTheDocument();
    expect(screen.getByText('Abogado · Invitación pendiente')).toBeInTheDocument();
  });
});

describe('Activación del miembro', () => {
  const props = { search: '?firma=firma-real', hash: `#invitacion=${invitation.invitacion_id}&token=${invitation.token}` };

  it('valida la confirmación, activa y ofrece iniciar sesión', async () => {
    show(<ActivarEquipo {...props} />);
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'Prueba-equipo-2026!' } });
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Diferente-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar acceso' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Las contraseñas no coinciden');
    expect(activarMiembro).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Confirmar contraseña'), { target: { value: 'Prueba-equipo-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activar acceso' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Tu acceso está activo');
    expect(activarMiembro).toHaveBeenCalledWith({ firma_slug: 'firma-real', invitacion_id: invitation.invitacion_id,
      token: invitation.token, password: 'Prueba-equipo-2026!' }, expect.anything());
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/?firma=firma-real');
  });

  it('rechaza enlaces incompletos y muestra errores de activación', async () => {
    const view = show(<ActivarEquipo search="" hash="" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Enlace incompleto');
    view.unmount();
    vi.mocked(activarMiembro).mockRejectedValue(new Error('expired'));
    show(<ActivarEquipo {...props} />);
    for (const label of ['Contraseña', 'Confirmar contraseña']) {
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Prueba-equipo-2026!' } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Activar acceso' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Solicita un nuevo enlace');
  });
});
