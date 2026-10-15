import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Plus, Save } from 'lucide-react';

import { Tooltip } from '@/components/ui/Tooltip';
import type { MiembroEquipo, Tarea, TareaEstado, TareaPrioridad, TareaUpdate } from '@/types/tarea';
import { actualizarTarea, crearTarea, fetchMiembrosEquipo, fetchTareasAsunto } from '../api/tareas';
import { fechaISO, fechaLocalInput, fechaTrabajo } from '../fechas';
import './TareasAsunto.css';

const estados: Record<TareaEstado, string> = {
  pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada',
};
const prioridades: TareaPrioridad[] = ['baja', 'normal', 'alta', 'urgente'];
function errorTarea(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })?.response;
  if (response?.status === 409) return 'La tarea cambió. Tus cambios se conservan.';
  return typeof response?.data?.detail === 'string' ? response.data.detail : 'No se pudo guardar. Inténtalo de nuevo.';
}
function editorData(tarea: Tarea) {
  return {
    titulo: tarea.titulo, instruccion: tarea.instruccion, responsable_id: tarea.responsable.id,
    prioridad: tarea.prioridad, vence_en: fechaLocalInput(tarea.vence_en), estado: tarea.estado,
  };
}

function EditorTarea({ tarea, miembros, canManage, userId, onRefresh, onReload }: {
  tarea: Tarea; miembros: MiembroEquipo[]; canManage: boolean; userId: string;
  onRefresh: () => void; onReload: () => Promise<Tarea>;
}) {
  const manual = tarea.tipo === 'tarea_interna';
  const [datos, setDatos] = useState(() => editorData(tarea));
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = useRef(false);
  const version = useRef(tarea.updated_at);
  useEffect(() => {
    if (!dirty.current) { setDatos(editorData(tarea)); version.current = tarea.updated_at; }
  }, [tarea]);
  const mutation = useMutation({
    mutationFn: (payload: TareaUpdate) => actualizarTarea(tarea.id, payload),
    onSuccess: (saved) => {
      dirty.current = false;
      version.current = saved.updated_at;
      setDatos(editorData(saved));
      onRefresh();
    },
  });
  const reload = useMutation({
    mutationFn: onReload,
    onSuccess: (saved) => {
      dirty.current = false;
      version.current = saved.updated_at;
      setDatos(editorData(saved));
      setConfirmReload(false);
      mutation.reset();
    },
  });
  const busy = mutation.isPending || reload.isPending;
  const change = (key: keyof typeof datos, value: string) => {
    dirty.current = true;
    setDatos((current) => ({ ...current, [key]: value }));
  };
  const conflict = (mutation.error as { response?: { status?: number } })?.response?.status === 409;
  const memberOptions = miembros.some((member) => member.id === tarea.responsable.id)
    ? miembros : [{ ...tarea.responsable, rol: 'abogado' as const }, ...miembros];

  return <li className="expediente-task">
    <div className="row between task-heading">
      <strong>{tarea.titulo}</strong>
      <span className={`badge ${tarea.estado === 'completada' ? 'mint' : 'neutral'}`}>{estados[tarea.estado]}</span>
    </div>
    <div className="task-metadata muted small">
      <span>Responsable · {tarea.responsable.nombre}</span>
      <span>Prioridad {tarea.prioridad}</span>
      {tarea.vence_en && <span><CalendarClock size={14} aria-hidden="true" /> {fechaTrabajo(tarea.vence_en)}</span>}
      <Tooltip content={tarea.instruccion} />
      {!manual && <Tooltip content="Esta tarea corresponde al paso activo. Se completa desde la ruta del expediente." />}
    </div>
    {canManage && <details className="task-editor">
      <summary>{manual ? 'Editar tarea' : 'Programar paso'}</summary>
      <form onSubmit={(event) => {
        event.preventDefault();
        const payload: TareaUpdate = {
          expected_updated_at: version.current, prioridad: datos.prioridad, vence_en: fechaISO(datos.vence_en),
        };
        if (manual) {
          payload.titulo = datos.titulo;
          payload.instruccion = datos.instruccion;
          payload.estado = datos.estado;
          if (datos.responsable_id !== tarea.responsable.id) payload.responsable_id = datos.responsable_id;
        }
        if (!busy) mutation.mutate(payload);
      }}>
        <fieldset className="task-fields form-grid" disabled={busy}>
          {manual && <>
            <div className="field full"><label htmlFor={`task-title-${tarea.id}`}>Título</label>
              <input id={`task-title-${tarea.id}`} required maxLength={180} value={datos.titulo} onChange={(event) => change('titulo', event.target.value)} /></div>
            <div className="field full"><label htmlFor={`task-instruction-${tarea.id}`}>Instrucción</label>
              <textarea id={`task-instruction-${tarea.id}`} required maxLength={2000} value={datos.instruccion} onChange={(event) => change('instruccion', event.target.value)} /></div>
            <div className="field"><label htmlFor={`task-owner-${tarea.id}`}>Responsable de tarea</label>
              <select id={`task-owner-${tarea.id}`} required value={datos.responsable_id} onChange={(event) => change('responsable_id', event.target.value)}>
                {memberOptions.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}
              </select></div>
            <div className="field"><label htmlFor={`task-state-${tarea.id}`}>Estado de tarea</label>
              <select id={`task-state-${tarea.id}`} value={datos.estado} onChange={(event) => change('estado', event.target.value)}>
                {Object.entries(estados).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></div>
          </>}
          <div className="field"><label htmlFor={`task-priority-${tarea.id}`}>Prioridad</label>
            <select id={`task-priority-${tarea.id}`} value={datos.prioridad} onChange={(event) => change('prioridad', event.target.value)}>
              {prioridades.map((value) => <option key={value} value={value}>{value}</option>)}
            </select></div>
          <div className="field"><div className="row"><label htmlFor={`task-date-${tarea.id}`}>Vencimiento</label><Tooltip content="Hora local de este dispositivo. Puedes dejarla vacía." /></div>
            <input id={`task-date-${tarea.id}`} type="datetime-local" value={datos.vence_en} onChange={(event) => change('vence_en', event.target.value)} /></div>
        </fieldset>
        <div className="task-actions"><button className="secondary-button" type="submit" disabled={busy}><Save size={16} aria-hidden="true" />{mutation.isPending ? 'Guardando…' : 'Guardar tarea'}</button></div>
      </form>
    </details>}
    {!canManage && manual && tarea.responsable.id === userId && <div className="task-actions">
      {tarea.estado === 'pendiente' && <button className="secondary-button" type="button" disabled={busy}
        onClick={() => mutation.mutate({ expected_updated_at: version.current, estado: 'en_progreso' })}>Iniciar tarea</button>}
      {(tarea.estado === 'pendiente' || tarea.estado === 'en_progreso') && <button className="secondary-button" type="button" disabled={busy}
        onClick={() => mutation.mutate({ expected_updated_at: version.current, estado: 'completada' })}>Completar tarea</button>}
    </div>}
    {mutation.isError && <p className="form-error" role="alert">{errorTarea(mutation.error)}</p>}
    {mutation.isSuccess && <span className="muted small" role="status">Tarea actualizada</span>}
    {conflict && <div className="task-actions">
      {confirmReload ? <>
        <span>¿Descartar tus cambios y recargar?</span>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => reload.mutate()}>Descartar y recargar</button>
        <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmReload(false)}>Conservar cambios</button>
      </> : <button className="secondary-button" type="button" onClick={() => setConfirmReload(true)}>Recargar tarea</button>}
      <Tooltip content="Recargar reemplaza tu edición por la última versión guardada." />
    </div>}
    {reload.isError && <p className="form-error" role="alert">No se pudo recargar. Tus cambios se conservan.</p>}
  </li>;
}

export function TareasAsunto({ asuntoId, abogadoId, userId, canManage }: {
  asuntoId: string; abogadoId?: string; userId: string; canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['tareas', 'asunto', asuntoId], queryFn: () => fetchTareasAsunto(asuntoId), retry: 1 });
  const equipo = useQuery({ queryKey: ['equipo', 'miembros'], queryFn: fetchMiembrosEquipo, enabled: canManage, retry: 1 });
  const miembros = (equipo.data || []).filter((member) => member.rol !== 'abogado' || member.id === abogadoId);
  const [titulo, setTitulo] = useState('');
  const [instruccion, setInstruccion] = useState('');
  const [responsable, setResponsable] = useState(abogadoId || '');
  const [prioridad, setPrioridad] = useState<TareaPrioridad>('normal');
  const [fecha, setFecha] = useState('');
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['tareas'] });
  const crear = useMutation({
    mutationFn: () => crearTarea({ asunto_id: asuntoId, titulo, instruccion, responsable_id: responsable, prioridad, vence_en: fechaISO(fecha) }),
    onSuccess: () => { setTitulo(''); setInstruccion(''); setFecha(''); setPrioridad('normal'); refresh(); },
  });
  return <section className="panel expediente-tasks" id="tareas-expediente" tabIndex={-1} aria-label="Tareas del expediente">
    <div className="section-title"><h3>Tareas del expediente</h3><Tooltip content="Delegar una tarea conserva el abogado responsable del expediente. Los pasos se completan desde la ruta." /></div>
    {canManage && <details className="task-create"><summary><Plus size={16} aria-hidden="true" /> Nueva tarea</summary>
      {equipo.isError && <div className="task-actions" role="alert"><span>No se pudo consultar el equipo.</span><button className="secondary-button" type="button" onClick={() => equipo.refetch()}>Reintentar equipo</button></div>}
      <form onSubmit={(event) => { event.preventDefault(); if (!crear.isPending) crear.mutate(); }}>
        <fieldset className="task-fields form-grid" disabled={crear.isPending || equipo.isLoading || equipo.isError}>
          <div className="field full"><label htmlFor="new-task-title">Título de tarea</label><input id="new-task-title" required maxLength={180} value={titulo} onChange={(event) => setTitulo(event.target.value)} /></div>
          <div className="field full"><label htmlFor="new-task-instruction">Instrucción de tarea</label><textarea id="new-task-instruction" required maxLength={2000} value={instruccion} onChange={(event) => setInstruccion(event.target.value)} /></div>
          <div className="field"><label htmlFor="new-task-owner">Asignar a</label><select id="new-task-owner" required value={responsable} onChange={(event) => setResponsable(event.target.value)}><option value="">Seleccionar</option>{miembros.map((member) => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></div>
          <div className="field"><label htmlFor="new-task-priority">Prioridad de tarea</label><select id="new-task-priority" value={prioridad} onChange={(event) => setPrioridad(event.target.value as TareaPrioridad)}>{prioridades.map((value) => <option key={value} value={value}>{value}</option>)}</select></div>
          <div className="field"><div className="row"><label htmlFor="new-task-date">Vencimiento de tarea</label><Tooltip content="Hora local de este dispositivo. Puedes dejarla vacía." /></div><input id="new-task-date" type="datetime-local" value={fecha} onChange={(event) => setFecha(event.target.value)} /></div>
        </fieldset>
        <div className="task-actions"><button className="primary-button" type="submit" disabled={crear.isPending || !equipo.data}>{crear.isPending ? 'Creando…' : 'Crear tarea'}</button></div>
        {crear.isError && <p className="form-error" role="alert">{errorTarea(crear.error)}</p>}
        {crear.isSuccess && <span className="muted small" role="status">Tarea creada</span>}
      </form>
    </details>}
    {query.isLoading && <p className="muted" role="status">Consultando tareas…</p>}
    {query.isError && <div className="task-actions" role="alert"><span>{query.data ? 'Mostrando las últimas tareas disponibles.' : 'No se pudieron consultar las tareas.'}</span><button className="secondary-button" type="button" onClick={() => query.refetch()}>Reintentar tareas</button></div>}
    {query.data?.length === 0 && <p className="muted small">Sin tareas registradas.</p>}
    {query.data && <ul className="expediente-task-list">{query.data.map((tarea) => <EditorTarea key={tarea.id} tarea={tarea} miembros={miembros} canManage={canManage} userId={userId} onRefresh={refresh} onReload={async () => {
      const result = await query.refetch();
      const saved = result.data?.find((item) => item.id === tarea.id);
      if (result.isError || !saved) throw new Error('No disponible');
      return saved;
    }} />)}</ul>}
  </section>;
}
