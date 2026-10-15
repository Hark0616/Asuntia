import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditarRegistro } from '../EditarRegistro';

const campos = [{ key: 'nombre', label: 'Nombre', required: true }, { key: 'email', label: 'Correo', type: 'email' as const }];
const initial = { version: '2026-10-15T12:00:00Z', values: { nombre: 'Cliente original', email: 'original@example.com' } };
const cargar = vi.fn();
const guardar = vi.fn();
function prepare() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><EditarRegistro title="Editar cliente" campos={campos}
    queryKey={['edicion', 'cliente-1']} cargar={cargar} guardar={guardar} /></QueryClientProvider>);
  return queryClient;
}
function conflict() {
  return new AxiosError('Conflict', undefined, undefined, undefined, { status: 409, data: { detail: 'El cliente cambió. Recarga sus datos antes de guardar' }, headers: {}, statusText: 'Conflict', config: {} as never });
}
beforeEach(() => {
  vi.resetAllMocks();
  cargar.mockResolvedValue(initial);
  guardar.mockResolvedValue({});
  vi.spyOn(window, 'confirm').mockReturnValue(false);
});

describe('Edición versionada', () => {
  it('permite cerrar con Escape cuando ya hay datos en caché y la consulta sigue pendiente', async () => {
    const user = userEvent.setup(); const queryClient = prepare();
    queryClient.setQueryDefaults(['edicion'], { gcTime: Infinity });
    queryClient.setQueryData(['edicion', 'cliente-1'], initial);
    cargar.mockImplementation(() => new Promise(() => {}));
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    await screen.findByLabelText('Nombre');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar cliente' })).toHaveFocus();
  });
  it('consulta al abrir y guarda con la versión que originó la captura', async () => {
    const user = userEvent.setup(); prepare();
    expect(cargar).not.toHaveBeenCalled();
    const trigger = screen.getByRole('button', { name: 'Editar cliente' });
    await user.click(trigger);
    const name = await screen.findByLabelText('Nombre');
    expect(name).toHaveValue(initial.values.nombre);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    await user.clear(name); await user.type(name, 'Cliente corregido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ version: initial.version, values: { ...initial.values, nombre: 'Cliente corregido' } }));
    expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('conserva captura y versión ante un conflicto o una consulta tardía', async () => {
    const user = userEvent.setup(); const queryClient = prepare();
    guardar.mockRejectedValue(conflict());
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    const name = await screen.findByLabelText('Nombre');
    await user.clear(name); await user.type(name, 'Mi borrador');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('El cliente cambió');
    act(() => { queryClient.setQueryData(['edicion', 'cliente-1'], { version: '2026-10-15T13:00:00Z', values: { ...initial.values, nombre: 'Edición ajena' } }); });
    expect(name).toHaveValue('Mi borrador');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardar).toHaveBeenLastCalledWith(expect.objectContaining({ version: initial.version }));
    await user.click(screen.getByRole('button', { name: 'Recargar datos' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(name).toHaveValue('Mi borrador');
  });

  it('recarga explícitamente tras confirmar el descarte y usa la nueva versión', async () => {
    const user = userEvent.setup(); prepare(); guardar.mockRejectedValueOnce(conflict());
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    await user.type(await screen.findByLabelText('Nombre'), ' mío');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await screen.findByRole('alert');
    vi.mocked(window.confirm).mockReturnValue(true);
    cargar.mockResolvedValue({ version: '2026-10-15T13:00:00Z', values: { ...initial.values, nombre: 'Dato actual' } });
    await user.click(screen.getByRole('button', { name: 'Recargar datos' }));
    await waitFor(() => expect(screen.getByLabelText('Nombre')).toHaveValue('Dato actual'));
    await user.type(screen.getByLabelText('Nombre'), ' revisado');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(guardar).toHaveBeenLastCalledWith(expect.objectContaining({ version: '2026-10-15T13:00:00Z' })));
  });

  it('protege el borrador al cancelar o pulsar Escape y restaura el foco', async () => {
    const user = userEvent.setup(); prepare();
    const trigger = screen.getByRole('button', { name: 'Editar cliente' });
    await user.click(trigger); await user.type(await screen.findByLabelText('Nombre'), ' corregido');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    vi.mocked(window.confirm).mockReturnValue(true);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  });

  it('muestra fallo de consulta con reintento y permite salir', async () => {
    const user = userEvent.setup(); prepare(); cargar.mockRejectedValue(new Error('red'));
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos consultar');
    cargar.mockResolvedValue(initial);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Nombre')).toHaveValue(initial.values.nombre);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('impide doble envío y cierre mientras guarda', async () => {
    const user = userEvent.setup(); prepare(); let finish!: () => void;
    guardar.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    await user.click(screen.getByRole('button', { name: 'Editar cliente' }));
    await user.type(await screen.findByLabelText('Nombre'), ' corregido');
    await user.dblClick(screen.getByRole('button', { name: 'Guardar cambios' }));
    expect(guardar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => finish());
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
