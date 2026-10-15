import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { useMutation, useQuery, type QueryKey } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Pencil, X } from 'lucide-react';
import { Tooltip } from './Tooltip';
import './EditarRegistro.css';

export interface CampoEdicion {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'date' | 'tel' | 'textarea';
  required?: boolean;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  help?: string;
}
export interface RegistroEdicion { version: string; values: Record<string, string> }
interface Props {
  title: string;
  campos: CampoEdicion[];
  queryKey: QueryKey;
  cargar: () => Promise<RegistroEdicion>;
  guardar: (registro: RegistroEdicion) => Promise<unknown>;
}

function mensaje(error: unknown) {
  const detail = isAxiosError(error) ? error.response?.data?.detail : undefined;
  return typeof detail === 'string' ? detail : 'No pudimos guardar. Revisa los datos e inténtalo de nuevo.';
}

export function EditarRegistro({ title, campos, queryKey, cargar, guardar }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <>
    <button ref={trigger} type="button" className="secondary-button" onClick={() => { setSaved(false); setOpen(true); }}>
      <Pencil size={16} aria-hidden="true" />{title}
    </button>
    {saved && <span className="muted small" role="status">Cambios guardados</span>}
    {open && <RegistroAbierto title={title} campos={campos} queryKey={queryKey} cargar={cargar} guardar={guardar}
      onClose={close} onSaved={() => { setSaved(true); close(); }} />}
  </>;
}

function RegistroAbierto({ title, campos, queryKey, cargar, guardar, onClose, onSaved }: Props & { onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const query = useQuery({ queryKey, queryFn: cargar, staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, retry: false });
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  const close = () => { dialog.current?.close(); onClose(); };
  return <dialog ref={dialog} className="registro-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); if (!query.data) close(); }}>
      {query.isPending ? <div><p role="status">Consultando datos…</p><button className="secondary-button" onClick={close}>Cerrar</button></div>
        : !query.data ? <div><p role="alert">No pudimos consultar los datos.</p>
          <button className="secondary-button" onClick={() => query.refetch()}>Reintentar</button>
          <button className="secondary-button" onClick={close}>Cerrar</button></div>
          : <Formulario title={title} campos={campos} initial={query.data}
            guardar={guardar} recargar={async () => {
              const result = await query.refetch();
              if (!result.data || result.error) throw new Error('No pudimos consultar los datos');
              return result.data;
            }} dialog={dialog} onClose={close} onSaved={() => { dialog.current?.close(); onSaved(); }} />}
    </dialog>;
}

function Formulario({ title, campos, initial, guardar, recargar, dialog, onClose, onSaved }: {
  title: string; campos: CampoEdicion[]; initial: RegistroEdicion;
  guardar: Props['guardar']; recargar: () => Promise<RegistroEdicion>;
  dialog: RefObject<HTMLDialogElement | null>; onClose: () => void; onSaved: () => void;
}) {
  const id = useId();
  const [baseline, setBaseline] = useState(initial);
  const [values, setValues] = useState(initial.values);
  const [reloadError, setReloadError] = useState('');
  const [reloading, setReloading] = useState(false);
  const dirty = campos.some(campo => values[campo.key] !== baseline.values[campo.key]);
  const mutation = useMutation({ mutationFn: () => guardar({ version: baseline.version, values }), onSuccess: onSaved });
  const busy = mutation.isPending || reloading;
  const close = () => { if (!busy && (!dirty || confirm('¿Descartar los cambios?'))) onClose(); };
  useEffect(() => {
    const modal = dialog.current;
    const cancel = (event: Event) => { event.preventDefault(); close(); };
    modal?.addEventListener('cancel', cancel);
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { modal?.removeEventListener('cancel', cancel); window.removeEventListener('beforeunload', beforeUnload); };
  }, [dialog, dirty, busy]);
  const reload = async () => {
    if (dirty && !confirm('¿Descartar los cambios y recargar los datos?')) return;
    setReloadError(''); setReloading(true);
    try { const data = await recargar(); setBaseline(data); setValues(data.values); mutation.reset(); }
    catch { setReloadError('No pudimos recargar los datos. Inténtalo de nuevo.'); }
    finally { setReloading(false); }
  };
  return <form onSubmit={event => { event.preventDefault(); if (!busy && dirty) mutation.mutate(); }}>
    <div className="registro-dialog-heading"><h2>{title}</h2>
      <button className="secondary-button" aria-label="Cerrar edición" type="button" onClick={close} disabled={busy}><X size={18} aria-hidden="true" /></button>
    </div>
    <fieldset disabled={busy} className="registro-campos">
      {campos.map((campo, index) => <div className={`field${campo.type === 'textarea' ? ' registro-campo-completo' : ''}`} key={campo.key}>
        <div className="row"><label htmlFor={`${id}-${campo.key}`}>{campo.label}</label>{campo.help && <Tooltip content={campo.help} />}</div>
        {campo.options ? <select id={`${id}-${campo.key}`} value={values[campo.key] || ''} required={campo.required}
          onChange={event => setValues({ ...values, [campo.key]: event.target.value })}>
          {campo.options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select> : campo.type === 'textarea' ? <textarea id={`${id}-${campo.key}`} value={values[campo.key] || ''} maxLength={campo.maxLength}
          onChange={event => setValues({ ...values, [campo.key]: event.target.value })} />
          : <input id={`${id}-${campo.key}`} type={campo.type || 'text'} value={values[campo.key] || ''}
            autoFocus={index === 0} required={campo.required} maxLength={campo.maxLength}
            onChange={event => setValues({ ...values, [campo.key]: event.target.value })} />}
      </div>)}
    </fieldset>
    {(mutation.isError || reloadError) && <div role="alert"><p>{reloadError || mensaje(mutation.error)}</p>
      <button className="secondary-button" type="button" disabled={busy} onClick={reload}>Recargar datos</button></div>}
    <div className="registro-acciones">
      <button className="secondary-button" type="button" disabled={busy} onClick={close}>Cancelar</button>
      <button className="primary-button" type="submit" disabled={busy || !dirty}>{mutation.isPending ? 'Guardando…' : 'Guardar cambios'}</button>
    </div>
  </form>;
}
