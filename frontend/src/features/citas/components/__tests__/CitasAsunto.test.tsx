import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CitasAsunto, SeleccionarCita } from '../CitasAsunto';
import { actualizarCita, cancelarCita, crearCita, fetchCita, fetchCitas, fetchHistorialCita } from '../../api/citas';
import { fetchMiembrosEquipo } from '@/features/tareas/api/tareas';
import { fechaEnZona, instanteEnZona } from '../../fechas';
import type { Cita } from '@/types/cita';

vi.mock('../../api/citas', () => ({ actualizarCita: vi.fn(), cancelarCita: vi.fn(), crearCita: vi.fn(), fetchCita: vi.fn(), fetchCitas: vi.fn(), fetchHistorialCita: vi.fn() }));
vi.mock('@/features/tareas/api/tareas', () => ({ fetchMiembrosEquipo: vi.fn() }));
const cita: Cita = { id:'cita-1', asunto_id:'asunto-1', tipo:'audiencia', titulo:'Audiencia de prueba',
  inicio:'2026-10-30T14:00:45.123Z',fin:'2026-10-30T15:00:45.123Z',zona_horaria:'America/Bogota',
  responsable_id:'abogado-1',responsable:{id:'abogado-1',nombre:'Ana'},participantes_ids:['aux-1'],
  lugar:null,enlace:'https://meet.example.com',resumen:'Preparar certificados',estado:'programada',motivo_cancelacion:null,
  created_at:'2026-10-15T12:00:00Z',updated_at:'2026-10-15T12:00:00Z',created_by_id:'abogado-1' };

function mount() {
  const client = new QueryClient({ defaultOptions: { queries:{retry:false},mutations:{retry:false} } });
  render(<QueryClientProvider client={client}><CitasAsunto asuntoId="asunto-1" abogadoId="abogado-1" /></QueryClientProvider>);
  return client;
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchCitas).mockResolvedValue([cita]);vi.mocked(fetchCita).mockResolvedValue(cita);
  vi.mocked(fetchMiembrosEquipo).mockResolvedValue([{id:'abogado-1',nombre:'Ana',rol:'abogado'},{id:'aux-1',nombre:'Sandra',rol:'auxiliar'}]);
  vi.mocked(crearCita).mockResolvedValue(cita);vi.mocked(actualizarCita).mockResolvedValue(cita);vi.mocked(cancelarCita).mockResolvedValue({...cita,estado:'cancelada'});
  vi.mocked(fetchHistorialCita).mockResolvedValue([]);
});

describe('citas del expediente', () => {
  it('crea en Bogotá, conserva UUID al reintentar e invalida ambas vistas', async () => {
    const user = userEvent.setup(); const client = mount(); const invalidate = vi.spyOn(client,'invalidateQueries');
    await user.click(screen.getByRole('button',{name:'Nueva cita'}));
    const dialog = await screen.findByRole('dialog'); await within(dialog).findByLabelText('Título');
    await user.type(within(dialog).getByLabelText('Título'),'Reunión inicial');
    fireEvent.change(within(dialog).getByLabelText('Inicio'),{target:{value:'2026-10-30T09:00'}});
    fireEvent.change(within(dialog).getByLabelText('Fin'),{target:{value:'2026-10-30T10:00'}});
    await user.click(within(dialog).getByLabelText('Sandra'));
    vi.mocked(crearCita).mockRejectedValueOnce(new Error('Sin conexión'));
    await user.click(within(dialog).getByRole('button',{name:'Crear cita'}));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Sin conexión');
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Reunión inicial');
    const first = vi.mocked(crearCita).mock.calls[0];
    await user.click(within(dialog).getByRole('button',{name:'Crear cita'}));
    await screen.findByText('Cita creada');
    expect(crearCita).toHaveBeenLastCalledWith('asunto-1',first[1],expect.objectContaining({inicio:'2026-10-30T14:00:00.000Z',fin:'2026-10-30T15:00:00.000Z',participantes_ids:['aux-1'],zona_horaria:'America/Bogota'}));
    expect(invalidate).toHaveBeenCalledWith({queryKey:['citas']});expect(invalidate).toHaveBeenCalledWith({queryKey:['tareas','agenda']});
    expect(screen.getByRole('button',{name:'Nueva cita'})).toHaveFocus();
  });

  it('un conflicto conserva versión y captura hasta recargar explícitamente', async () => {
    const user = userEvent.setup();mount();await user.click(await screen.findByRole('button',{name:'Editar cita'}));
    const dialog = await screen.findByRole('dialog');const input = await within(dialog).findByLabelText('Título');
    await user.clear(input);await user.type(input,'Mi corrección');
    vi.mocked(actualizarCita).mockRejectedValue(new Error('La cita cambió'));
    await user.click(within(dialog).getByRole('button',{name:'Guardar cita'}));
    await within(dialog).findByRole('alert');
    expect(actualizarCita).toHaveBeenLastCalledWith('cita-1',cita.updated_at,expect.objectContaining({titulo:'Mi corrección',inicio:cita.inicio,fin:cita.fin}));
    expect(input).toHaveValue('Mi corrección');
    vi.mocked(fetchCita).mockResolvedValue({...cita,titulo:'Cambio de oficina',updated_at:'2026-10-16T12:00:00Z'});
    const confirm = vi.spyOn(window,'confirm').mockReturnValue(true);
    await user.click(within(dialog).getByRole('button',{name:'Recargar cita'}));
    await waitFor(() => expect(input).toHaveValue('Cambio de oficina'));expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('cancelar pide motivo y versión; mantiene el registro', async () => {
    const user = userEvent.setup();mount();await user.click(await screen.findByRole('button',{name:'Cancelar cita'}));
    const dialog = await screen.findByRole('dialog');await user.type(await within(dialog).findByLabelText('Motivo de cancelación'),'Cambio de fecha');
    vi.mocked(fetchCitas).mockResolvedValue([{...cita,estado:'cancelada'}]);
    await user.click(within(dialog).getByRole('button',{name:'Confirmar cancelación'}));
    await screen.findByText('Cita cancelada');
    expect(cancelarCita).toHaveBeenCalledWith('cita-1',cita.updated_at,'Cambio de fecha');
    expect(screen.getByText('Audiencia de prueba')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Nueva cita'})).toHaveFocus();
  });

  it('avisa al descartar y bloquea cierre y doble envío mientras guarda', async () => {
    const user = userEvent.setup();mount();await user.click(await screen.findByRole('button',{name:'Editar cita'}));
    const dialog = await screen.findByRole('dialog');await user.type(await within(dialog).findByLabelText('Título'),' revisada');
    const confirm = vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent(dialog,new Event('cancel',{cancelable:true}));
    expect(confirm).toHaveBeenCalled();expect(dialog).toBeInTheDocument();
    let finish!: (value:Cita)=>void;vi.mocked(actualizarCita).mockReturnValue(new Promise(resolve => {finish=resolve;}));
    await user.dblClick(within(dialog).getByRole('button',{name:'Guardar cita'}));
    expect(actualizarCita).toHaveBeenCalledTimes(1);expect(within(dialog).getByRole('button',{name:'Volver'})).toBeDisabled();
    fireEvent(dialog,new Event('cancel',{cancelable:true}));expect(dialog).toBeInTheDocument();
    finish(cita);await screen.findByText('Cita actualizada');expect(screen.getByRole('button',{name:'Editar cita'})).toHaveFocus();confirm.mockRestore();
  });

  it('consulta el historial solo al abrirlo y conserva canceladas sin acciones de edición', async () => {
    const user = userEvent.setup();vi.mocked(fetchCitas).mockResolvedValue([{...cita,estado:'cancelada',motivo_cancelacion:'Por solicitud'}]);mount();
    await screen.findByText('Por solicitud',{exact:false});expect(screen.queryByRole('button',{name:'Editar cita'})).not.toBeInTheDocument();
    expect(fetchHistorialCita).not.toHaveBeenCalled();await user.click(screen.getByText('Historial'));
    await waitFor(() => expect(fetchHistorialCita).toHaveBeenCalledWith('cita-1'));
  });

  it('un error de consulta ofrece recuperación sin inventar un vacío', async () => {
    vi.mocked(fetchCitas).mockRejectedValue(new Error('Offline'));mount();
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos actualizar');
    expect(screen.queryByText('Sin citas registradas')).not.toBeInTheDocument();
  });

  it('la guía elige solo audiencias programadas del mismo expediente', async () => {
    vi.mocked(fetchCitas).mockResolvedValue([cita,{...cita,id:'reunion',tipo:'reunion'},{...cita,id:'cancelada',estado:'cancelada'}]);
    const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
    render(<QueryClientProvider client={client}><SeleccionarCita asuntoId="asunto-1" value="" onChange={()=>{}} id="audiencia" required /></QueryClientProvider>);
    await screen.findByRole('option',{name:/Audiencia de prueba/});expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('link',{name:'Ver citas del expediente'})).toHaveAttribute('href','#citas-expediente');
  });
});

describe('zona de captura', () => {
  it('conserva la fecha civil de Bogotá al cambiar mes y año', () => {
    expect(instanteEnZona('2026-12-31T23:30','America/Bogota')).toBe('2027-01-01T04:30:00.000Z');
    expect(fechaEnZona('2027-01-01T04:30:00Z','America/Bogota')).toBe('2026-12-31T23:30');
  });
  it('rechaza horas inexistentes o repetidas por horario de verano', () => {
    expect(()=>instanteEnZona('2026-03-08T02:30','America/New_York')).toThrow('no existe');
    expect(()=>instanteEnZona('2026-11-01T01:30','America/New_York')).toThrow('se repite');
  });
});
