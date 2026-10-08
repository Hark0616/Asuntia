import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { FlujoAsunto } from '../FlujoAsunto';
import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';
import { fechaLocalInput } from '@/features/tareas/fechas';


const pasos: AsuntoPasoAPI[] = [
  {
    id: 'paso-1',
    orden: 1,
    codigo: 'radicacion',
    titulo: 'Radicación',
    descripcion: 'Registra la radicación oficial.',
    estado: 'activo',
    campos: [
      {
        clave: 'radicado_oficial',
        etiqueta: 'Radicado oficial',
        tipo: 'text',
        requerido: true,
        opciones: [],
      },
      {
        clave: 'fecha_radicacion',
        etiqueta: 'Fecha de radicación',
        tipo: 'date',
        requerido: true,
        opciones: [],
      },
    ],
    datos: {},
    updated_at: '2026-10-02T12:00:00Z',
  },
  {
    id: 'paso-2',
    orden: 2,
    codigo: 'agendar_audiencia',
    titulo: 'Agendar audiencia',
    descripcion: 'Define la audiencia.',
    estado: 'bloqueado',
    campos: [],
    datos: {},
  },
];


describe('FlujoAsunto', () => {
  const audiencia: AsuntoPasoAPI = {
    ...pasos[0], codigo: 'agendar_audiencia', titulo: 'Agendar audiencia',
    campos: [{ clave: 'fecha_hora', etiqueta: 'Fecha y hora', tipo: 'datetime', requerido: true, opciones: [] }],
    datos: { fecha_hora: '2026-10-15T09:30:00' },
  };

  it('recupera una audiencia legacy en Bogotá y guarda nuevas fechas con zona horaria', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ pasos: [{ ...audiencia, datos: { fecha_hora: '2026-10-16T15:45:00Z' } }] });
    render(<FlujoAsunto pasos={[audiencia]} flujoEstado="activo" canAdvance={false} canSave onSave={onSave} onAdvance={vi.fn()} />);
    const input = screen.getByLabelText(/Fecha y hora/);
    expect(input).toHaveAttribute('type', 'datetime-local');
    expect(input).toHaveValue(fechaLocalInput('2026-10-15T14:30:00Z'));
    fireEvent.change(input, { target: { value: '2026-10-16T10:45' } });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(onSave).toHaveBeenCalledWith('agendar_audiencia', {
      fecha_hora: new Date('2026-10-16T10:45').toISOString(),
    }, audiencia.updated_at);
    expect(await screen.findByText('Borrador guardado')).toBeInTheDocument();
    expect(input).toHaveValue(fechaLocalInput('2026-10-16T15:45:00Z'));
  });

  it('completa una audiencia legacy como instante de Bogotá y conserva segundos', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(<FlujoAsunto pasos={[{ ...audiencia, datos: { fecha_hora: '2026-10-15T09:30:45' } }]} flujoEstado="activo" onAdvance={onAdvance} />);
    await user.click(screen.getByRole('button', { name: 'Completar ruta' }));
    expect(onAdvance).toHaveBeenCalledWith('agendar_audiencia', {
      fecha_hora: '2026-10-15T14:30:45.000Z',
    }, audiencia.updated_at);
  });

  it('permite borrar la fecha en un borrador parcial sin enviar una fecha inválida', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ pasos: [{ ...audiencia, datos: { fecha_hora: null } }] });
    render(<FlujoAsunto pasos={[audiencia]} flujoEstado="activo" canAdvance={false} canSave onSave={onSave} onAdvance={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Fecha y hora/), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(onSave).toHaveBeenCalledWith('agendar_audiencia', { fecha_hora: null }, audiencia.updated_at);
    expect(await screen.findByText('Borrador guardado')).toBeInTheDocument();
  });

  it('muestra el paso activo y envía sus datos', async () => {
    const onAdvance = vi.fn().mockResolvedValue(undefined);
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        onAdvance={onAdvance}
      />,
    );

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('Agendar audiencia')).toBeInTheDocument();
    expect(screen.getByText('Siguiente')).toBeInTheDocument();
    const actionHeading = screen.getByRole('heading', { name: 'Radicación' });
    const routeHeading = screen.getByText('Ruta completa');
    expect(
      actionHeading.compareDocumentPosition(routeHeading)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const activeStepSummary = screen.getByText('Paso 1', { selector: 'small' }).closest('summary');
    expect(activeStepSummary).toHaveAttribute('aria-current', 'step');

    fireEvent.change(screen.getByLabelText(/Radicado oficial/), {
      target: { value: 'RAD-2026-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Usar hoy' }));
    const filingDate = screen.getByLabelText(/Fecha de radicación/) as HTMLInputElement;
    expect(filingDate.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.click(screen.getByRole('button', { name: /Completar y continuar/ }));

    await waitFor(() => {
      expect(onAdvance).toHaveBeenCalledWith('radicacion', {
        radicado_oficial: 'RAD-2026-001',
        fecha_radicacion: filingDate.value,
      }, '2026-10-02T12:00:00Z');
    });
  });

  it('permite consultar la descripción de una etapa futura sin habilitarla', () => {
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        onAdvance={vi.fn()}
      />,
    );

    const futureSummary = screen.getByText('Agendar audiencia').closest('summary');
    const futureDetails = futureSummary?.closest('details');
    expect(futureDetails).not.toHaveAttribute('open');

    fireEvent.click(futureSummary!);
    expect(futureDetails).toHaveAttribute('open');
    expect(screen.getByText('Define la audiencia.')).toBeInTheDocument();
  });

  it('muestra la ruta sin controles de avance cuando el rol es de consulta', () => {
    render(
      <FlujoAsunto
        pasos={pasos}
        flujoEstado="activo"
        canAdvance={false}
        onAdvance={vi.fn()}
      />,
    );

    expect(screen.getByText('Paso 1 de 2')).toBeInTheDocument();
    expect(screen.getAllByText('Registra la radicación oficial.')).toHaveLength(1);
    expect(screen.getByText('Este paso está asignado a otro responsable.')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Radicado oficial/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Completar/ })).not.toBeInTheDocument();
  });

  it('guarda una captura parcial del auxiliar sin validar ni completar el paso', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ pasos: [{ ...pasos[0], datos: { radicado_oficial: 'Pendiente' }, updated_at: '2026-10-02T13:00:00Z' }] });
    const onAdvance = vi.fn();
    render(<FlujoAsunto pasos={pasos} flujoEstado="activo" canAdvance={false} canSave onSave={onSave} onAdvance={onAdvance} />);
    await user.type(screen.getByLabelText(/Radicado oficial/), 'Pendiente');
    expect(screen.queryByRole('button', { name: /Completar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(onSave).toHaveBeenCalledWith('radicacion', { radicado_oficial: 'Pendiente' }, '2026-10-02T12:00:00Z');
    expect(await screen.findByText('Borrador guardado')).toBeInTheDocument();
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('completar exige los campos requeridos aunque guardar acepta información parcial', async () => {
    const user = userEvent.setup();
    const onAdvance = vi.fn();
    render(<FlujoAsunto pasos={pasos} flujoEstado="activo" onAdvance={onAdvance} />);
    await user.type(screen.getByLabelText(/Radicado oficial/), 'RAD-1');
    await user.click(screen.getByRole('button', { name: /Completar y continuar/ }));
    expect(onAdvance).not.toHaveBeenCalled();
  });

  it('recupera datos guardados y conserva la escritura ante un refetch del mismo paso', () => {
    const initial = [{ ...pasos[0], datos: { radicado_oficial: 'Guardado' } }, pasos[1]];
    const { rerender } = render(<FlujoAsunto pasos={initial} flujoEstado="activo" onAdvance={vi.fn()} />);
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Guardado');
    fireEvent.change(screen.getByLabelText(/Radicado oficial/), { target: { value: 'Mi cambio' } });
    rerender(<FlujoAsunto pasos={[{ ...pasos[0], datos: { radicado_oficial: 'Otra persona' }, updated_at: '2026-10-02T13:00:00Z' }, pasos[1]]} flujoEstado="activo" onAdvance={vi.fn()} />);
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Mi cambio');
    expect(screen.getByText('Cambios sin guardar')).toBeInTheDocument();
  });

  it('un conflicto conserva datos y requiere confirmar el descarte para recargar', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue({ response: { status: 409, data: { detail: 'El borrador cambió.' } } });
    const onReload = vi.fn().mockResolvedValue({ pasos: [{ ...pasos[0], datos: { radicado_oficial: 'Remoto' }, updated_at: '2026-10-02T13:00:00Z' }] });
    render(<FlujoAsunto pasos={pasos} flujoEstado="activo" onSave={onSave} onReload={onReload} onAdvance={vi.fn()} />);
    await user.type(screen.getByLabelText(/Radicado oficial/), 'Local');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByText('El borrador cambió.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Local');
    await user.click(screen.getByRole('button', { name: 'Recargar borrador' }));
    expect(onReload).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Conservar cambios' }));
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Local');
    await user.click(screen.getByRole('button', { name: 'Recargar borrador' }));
    await user.click(screen.getByRole('button', { name: 'Descartar y recargar' }));
    expect(await screen.findByText('Borrador recargado')).toBeInTheDocument();
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Remoto');
  });

  it('al cambiar el expediente elimina los datos y errores del anterior', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error());
    const { rerender } = render(<FlujoAsunto key="asunto-1" pasos={pasos} flujoEstado="activo" onSave={onSave} onAdvance={vi.fn()} />);
    await user.type(screen.getByLabelText(/Radicado oficial/), 'Local');
    await user.click(screen.getByRole('button', { name: 'Guardar borrador' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    rerender(<FlujoAsunto key="asunto-2" pasos={[{ ...pasos[0], id: 'otro-paso', datos: { radicado_oficial: 'Otro expediente' } }]} flujoEstado="activo" onSave={onSave} onAdvance={vi.fn()} />);
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Otro expediente');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si otra persona completa el paso durante la captura conserva el borrador local', () => {
    const { rerender } = render(<FlujoAsunto pasos={pasos} flujoEstado="activo" onAdvance={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Radicado oficial/), { target: { value: 'Sin guardar' } });
    rerender(<FlujoAsunto pasos={[{ ...pasos[0], estado: 'completado' }, { ...pasos[1], estado: 'activo' }]} flujoEstado="activo" onAdvance={vi.fn()} />);
    expect(screen.getByLabelText(/Radicado oficial/)).toHaveValue('Sin guardar');
    expect(screen.getByRole('alert')).toHaveTextContent('El paso cambió.');
  });

  it('tras completar cambia al nuevo paso de la respuesta y limpia la captura anterior', async () => {
    const onAdvance = vi.fn().mockResolvedValue({ pasos: [{ ...pasos[0], estado: 'completado' }, { ...pasos[1], estado: 'activo' }] });
    render(<FlujoAsunto pasos={pasos} flujoEstado="activo" onAdvance={onAdvance} />);
    fireEvent.change(screen.getByLabelText(/Radicado oficial/), { target: { value: 'RAD-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Usar hoy' }));
    fireEvent.click(screen.getByRole('button', { name: /Completar y continuar/ }));
    expect(await screen.findByRole('heading', { name: 'Agendar audiencia' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Radicado oficial/)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
