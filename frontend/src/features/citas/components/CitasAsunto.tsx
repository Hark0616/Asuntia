import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { CalendarClock, Plus, X } from 'lucide-react';

import { Tooltip } from '@/components/ui/Tooltip';
import { fetchMiembrosEquipo } from '@/features/tareas/api/tareas';
import type { Cita, CitaDatos } from '@/types/cita';
import type { MiembroEquipo } from '@/types/tarea';
import { actualizarCita, cancelarCita, crearCita, fetchCita, fetchCitas, fetchHistorialCita } from '../api/citas';
import { fechaEnZona, instanteEnZona, mostrarCita } from '../fechas';
import '@/components/ui/EditarRegistro.css';
import './CitasAsunto.css';

function errorCita(error: unknown) {
  if (isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : 'Revisa los datos de la cita e inténtalo de nuevo.';
  }
  return error instanceof Error ? error.message : 'No pudimos guardar la cita.';
}

export function CitasAsunto({ asuntoId, abogadoId }: { asuntoId: string; abogadoId?: string }) {
  const query = useQuery({ queryKey: ['citas', 'asunto', asuntoId], queryFn: () => fetchCitas(asuntoId) });
  const [editor, setEditor] = useState<{ id?: string; cancelar?: boolean } | null>(null);
  const [saved, setSaved] = useState('');
  const trigger = useRef<HTMLElement | null>(null);
  const newTrigger = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const open = (element: HTMLElement, value: NonNullable<typeof editor>) => { trigger.current = element; setSaved(''); setEditor(value); };
  const close = () => { restoreFocus.current = true; setEditor(null); };
  useEffect(() => {
    if (!editor && restoreFocus.current) {
      restoreFocus.current = false;
      (trigger.current?.isConnected ? trigger.current : newTrigger.current)?.focus();
    }
  }, [editor]);
  useEffect(() => {
    if (!query.data || !location.hash.startsWith('#cita-')) return;
    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: 'center' }); target?.focus({ preventScroll: true });
  }, [query.data]);
  return <section className="panel expediente-citas" id="citas-expediente" tabIndex={-1}>
    <div className="section-title"><h3>Citas</h3><button ref={newTrigger} className="secondary-button" type="button"
      onClick={event => open(event.currentTarget, {})}><Plus size={16} aria-hidden="true" />Nueva cita</button></div>
    {saved && <p role="status" className="muted small">{saved}</p>}
    {query.isPending && <p role="status">Consultando citas…</p>}
    {query.isError && <div role="alert"><p>No pudimos actualizar las citas.</p><button className="secondary-button" onClick={() => query.refetch()}>Reintentar citas</button></div>}
    {query.data?.length === 0 && <p className="muted">Sin citas registradas</p>}
    <ul className="citas-lista">{query.data?.map(cita => <li key={cita.id} id={`cita-${cita.id}`} tabIndex={-1}>
      <div className="cita-heading"><strong>{cita.titulo}</strong><span className="muted small">{cita.tipo === 'audiencia' ? 'Audiencia' : 'Reunión'} · {cita.estado === 'cancelada' ? 'Cancelada' : 'Programada'}</span></div>
      <p className="cita-fecha"><CalendarClock size={16} aria-hidden="true" />{mostrarCita(cita.inicio, cita.zona_horaria)}</p>
      <p className="muted small">{cita.fin ? `Hasta ${mostrarCita(cita.fin, cita.zona_horaria)}` : 'Duración por confirmar'} · {cita.zona_horaria}</p>
      <p className="muted small">Responsable · {cita.responsable.nombre}</p>
      {cita.lugar && <p>{cita.lugar}</p>}
      {cita.enlace && <a href={cita.enlace} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir enlace de la cita</a>}
      {cita.resumen && <p className="cita-resumen">{cita.resumen}</p>}
      {cita.motivo_cancelacion && <p>Motivo · {cita.motivo_cancelacion}</p>}
      <div className="cita-acciones">{cita.estado === 'programada' && <>
        <button type="button" className="secondary-button" onClick={event => open(event.currentTarget, { id: cita.id })}>Editar cita</button>
        <button type="button" className="secondary-button" onClick={event => open(event.currentTarget, { id: cita.id, cancelar: true })}>Cancelar cita</button>
      </>}<HistorialCita id={cita.id} /></div>
    </li>)}</ul>
    {editor && <CitaModal asuntoId={asuntoId} abogadoId={abogadoId} editor={editor} onClose={close}
      onSaved={() => { setSaved(editor.cancelar ? 'Cita cancelada' : editor.id ? 'Cita actualizada' : 'Cita creada'); close(); }} />}
  </section>;
}

function HistorialCita({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({ queryKey: ['citas', id, 'historial'], queryFn: () => fetchHistorialCita(id), enabled: open });
  const labels: Record<string, string> = { creada: 'Creada', actualizada: 'Actualizada', reprogramada: 'Reprogramada', cancelada: 'Cancelada', migrada: 'Audiencia incorporada', transferida: 'Responsable transferido' };
  return <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Historial</summary>
    {query.isPending && <p role="status">Consultando historial…</p>}
    {query.isError && <button className="secondary-button" onClick={() => query.refetch()}>Reintentar historial</button>}
    <ol className="cita-historial">{query.data?.map(change => <li key={change.id}>
      <strong>{labels[change.accion] || change.accion}</strong> · {mostrarCita(change.created_at, 'America/Bogota')}
      {change.autor && <span className="muted small"> · {change.autor.nombre}</span>}
      {change.accion === 'reprogramada' && <CambioFecha datos={change.datos} />}
    </li>)}</ol>
  </details>;
}
function CambioFecha({ datos }: { datos: Record<string, unknown> }) {
  const before = datos.antes as CitaDatos | undefined;
  const after = datos.despues as CitaDatos | undefined;
  return before?.inicio && after?.inicio ? <p className="muted small">{mostrarCita(before.inicio, before.zona_horaria)} → {mostrarCita(after.inicio, after.zona_horaria)}</p> : null;
}

function CitaModal({ asuntoId, abogadoId, editor, onClose, onSaved }: {
  asuntoId: string; abogadoId?: string; editor: { id?: string; cancelar?: boolean }; onClose: () => void; onSaved: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const title = editor.cancelar ? 'Cancelar cita' : editor.id ? 'Editar cita' : 'Nueva cita';
  const query = useQuery({ queryKey: ['citas', 'editor', editor.id || asuntoId], queryFn: async () => {
    const [miembros, cita] = await Promise.all([fetchMiembrosEquipo(), editor.id ? fetchCita(editor.id) : Promise.resolve(undefined)]);
    return { miembros, cita };
  }, staleTime: 0, gcTime: 0, retry: false, refetchOnWindowFocus: false });
  useEffect(() => { modal.current?.showModal(); return () => modal.current?.close(); }, []);
  return <dialog ref={modal} className="registro-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); if (!query.data) onClose(); }}>
    {query.isPending ? <><p role="status">Consultando datos…</p><button className="secondary-button" onClick={onClose}>Cerrar</button></>
      : !query.data ? <><p role="alert">No pudimos consultar la cita.</p><button className="secondary-button" onClick={() => query.refetch()}>Reintentar</button><button className="secondary-button" onClick={onClose}>Cerrar</button></>
        : <CitaFormulario {...query.data} asuntoId={asuntoId} abogadoId={abogadoId} cancelar={editor.cancelar}
          modal={modal} title={title} onClose={onClose} onSaved={onSaved} />}
  </dialog>;
}

function CitaFormulario({ miembros, cita, asuntoId, abogadoId, cancelar, modal, title, onClose, onSaved }: {
  miembros: MiembroEquipo[]; cita?: Cita; asuntoId: string; abogadoId?: string; cancelar?: boolean;
  modal: RefObject<HTMLDialogElement | null>; title: string; onClose: () => void; onSaved: () => void;
}) {
  const [baseline, setBaseline] = useState(cita);
  const initial = (data?: Cita) => ({ tipo: data?.tipo || 'reunion', titulo: data?.titulo || '',
    inicio: data ? fechaEnZona(data.inicio, data.zona_horaria) : '', fin: data?.fin ? fechaEnZona(data.fin, data.zona_horaria) : '',
    responsable_id: data?.responsable_id || abogadoId || '', participantes_ids: data?.participantes_ids || [],
    lugar: data?.lugar || '', enlace: data?.enlace || '', resumen: data?.resumen || '', motivo: '' });
  const [values, setValues] = useState(() => initial(cita));
  const [baseValues, setBaseValues] = useState(() => initial(cita));
  const [reloadError, setReloadError] = useState('');
  const [reloading, setReloading] = useState(false);
  const operation = useRef({ id: crypto.randomUUID(), fingerprint: '' });
  const queryClient = useQueryClient();
  const id = useId();
  const zona = baseline?.zona_horaria || 'America/Bogota';
  const dirty = JSON.stringify(values) !== JSON.stringify(baseValues);
  const mutation = useMutation({ mutationFn: async () => {
    if (cancelar && baseline) return cancelarCita(baseline.id, baseline.updated_at, values.motivo);
    const data: CitaDatos = { tipo: values.tipo as CitaDatos['tipo'], titulo: values.titulo,
      inicio: baseline && values.inicio === baseValues.inicio ? baseline.inicio : instanteEnZona(values.inicio, zona),
      fin: baseline?.fin && values.fin === baseValues.fin ? baseline.fin : instanteEnZona(values.fin, zona), zona_horaria: zona,
      responsable_id: values.responsable_id, participantes_ids: values.participantes_ids,
      lugar: values.lugar || null, enlace: values.enlace || null, resumen: values.resumen || null };
    if (baseline) return actualizarCita(baseline.id, baseline.updated_at, data);
    const fingerprint = JSON.stringify(data);
    if (operation.current.fingerprint && operation.current.fingerprint !== fingerprint) operation.current.id = crypto.randomUUID();
    operation.current.fingerprint = fingerprint;
    return crearCita(asuntoId, operation.current.id, data);
  }, onSuccess: result => {
    queryClient.setQueryData<Cita[]>(['citas', 'asunto', asuntoId], current => current
      ? [...current.filter(item => item.id !== result.id), result].sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio)) : [result]);
    void queryClient.invalidateQueries({ queryKey: ['citas'] });
    void queryClient.invalidateQueries({ queryKey: ['tareas', 'agenda'] });
    onSaved();
  } });
  const busy = mutation.isPending || reloading;
  const close = () => { if (!busy && (!dirty || confirm('¿Descartar los cambios de la cita?'))) onClose(); };
  useEffect(() => {
    const dialog = modal.current;
    const cancel = (event: Event) => { event.preventDefault(); close(); };
    const unload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    dialog?.addEventListener('cancel', cancel); window.addEventListener('beforeunload', unload);
    return () => { dialog?.removeEventListener('cancel', cancel); window.removeEventListener('beforeunload', unload); };
  }, [modal, dirty, busy]);
  const reload = async () => {
    if (!baseline || (dirty && !confirm('¿Descartar los cambios y recargar la cita?'))) return;
    setReloadError(''); setReloading(true);
    try { const data = await fetchCita(baseline.id); setBaseline(data); setValues(initial(data)); setBaseValues(initial(data)); mutation.reset(); }
    catch { setReloadError('No pudimos recargar. Tus cambios se conservan.'); }
    finally { setReloading(false); }
  };
  const field = (key: 'titulo' | 'inicio' | 'fin' | 'lugar' | 'enlace' | 'motivo', label: string, type = 'text', required = false, maxLength?: number) => <div className="field">
    <label htmlFor={`${id}-${key}`}>{label}</label><input id={`${id}-${key}`} type={type} required={required} maxLength={maxLength}
      value={values[key]} onChange={event => setValues({ ...values, [key]: event.target.value })} /></div>;
  const equipo = miembros.filter(member => member.rol !== 'abogado' || member.id === abogadoId);
  return <form onSubmit={event => { event.preventDefault(); if (!busy) mutation.mutate(); }}>
    <div className="registro-dialog-heading"><h2>{title}</h2><button type="button" className="secondary-button" disabled={busy} aria-label="Cerrar cita" onClick={close}><X size={18} aria-hidden="true" /></button></div>
    {baseline?.estado === 'cancelada' ? <><p role="status">Esta cita ya está cancelada.</p><button className="secondary-button" type="button" onClick={close}>Cerrar</button></>
      : <><fieldset disabled={busy} className="registro-campos">
        {cancelar ? <><p className="registro-campo-completo">{baseline?.titulo}</p>{field('motivo', 'Motivo de cancelación', 'text', true, 500)}</> : <>
          {field('titulo', 'Título', 'text', true, 180)}
          <div className="field"><label htmlFor={`${id}-tipo`}>Tipo</label><select id={`${id}-tipo`} value={values.tipo} onChange={event => setValues({ ...values, tipo: event.target.value as CitaDatos['tipo'] })}><option value="reunion">Reunión</option><option value="audiencia">Audiencia</option></select></div>
          {field('inicio', 'Inicio', 'datetime-local', true)}{field('fin', 'Fin', 'datetime-local', true)}
          <div className="row registro-campo-completo muted small">Zona · {zona}<Tooltip content="Fecha y hora en la zona de la cita. La duración máxima es de 24 horas. Las audiencias migradas conservan la duración pendiente hasta que se confirme." /></div>
          <div className="field registro-campo-completo"><label htmlFor={`${id}-responsable`}>Responsable</label><select required id={`${id}-responsable`} value={values.responsable_id} onChange={event => setValues({ ...values, responsable_id: event.target.value })}>
            <option value="">Seleccionar</option>{baseline && !equipo.some(member => member.id === baseline.responsable_id) && <option value={baseline.responsable_id}>{baseline.responsable.nombre} (inactivo)</option>}
            {equipo.map(member => <option key={member.id} value={member.id}>{member.nombre}</option>)}</select></div>
          {field('lugar', 'Lugar', 'text', false, 300)}{field('enlace', 'Enlace', 'url', false, 1000)}
          <div className="field registro-campo-completo"><label htmlFor={`${id}-resumen`}>Resumen preparatorio</label><textarea id={`${id}-resumen`} maxLength={4000} value={values.resumen} onChange={event => setValues({ ...values, resumen: event.target.value })} /></div>
          <fieldset className="cita-participantes registro-campo-completo"><legend>Participantes del equipo</legend>
            {equipo.map(member => <label key={member.id}><input type="checkbox" checked={values.participantes_ids.includes(member.id)} onChange={event => setValues({ ...values, participantes_ids: event.target.checked ? [...values.participantes_ids, member.id] : values.participantes_ids.filter(value => value !== member.id) })} />{member.nombre}</label>)}
          </fieldset>
        </>}
      </fieldset>
      {(mutation.isError || reloadError) && <div role="alert"><p>{reloadError || errorCita(mutation.error)}</p>{baseline && <button className="secondary-button" type="button" disabled={busy} onClick={reload}>Recargar cita</button>}</div>}
      <div className="registro-acciones"><button type="button" className="secondary-button" disabled={busy} onClick={close}>Volver</button><button className="primary-button" disabled={busy || (Boolean(baseline) && !dirty)} type="submit">{mutation.isPending ? 'Guardando…' : cancelar ? 'Confirmar cancelación' : baseline ? 'Guardar cita' : 'Crear cita'}</button></div></>}
  </form>;
}

export function SeleccionarCita({ asuntoId, value, onChange, id, required }: {
  asuntoId?: string; value: string; onChange: (value: string) => void; id: string; required: boolean;
}) {
  const query = useQuery({ queryKey: ['citas', 'asunto', asuntoId], queryFn: () => fetchCitas(asuntoId!), enabled: Boolean(asuntoId) });
  const citas = query.data?.filter(cita => cita.tipo === 'audiencia' && cita.estado === 'programada') || [];
  return <><select id={id} value={value} onChange={event => onChange(event.target.value)} required={required} disabled={query.isPending || query.isError}>
    <option value="">Seleccionar audiencia</option>{value && !citas.some(cita => cita.id === value) && <option value={value}>Audiencia no disponible</option>}
    {citas.map(cita => <option key={cita.id} value={cita.id}>{cita.titulo} · {mostrarCita(cita.inicio, cita.zona_horaria)}</option>)}
  </select>{query.isError ? <button className="secondary-button" type="button" onClick={() => query.refetch()}>Reintentar audiencias</button>
    : <a href="#citas-expediente">Ver citas del expediente</a>}</>;
}
