import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronDown, LockKeyhole, Save } from 'lucide-react';

import type { AsuntoAPI, AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';
import { Tooltip } from '@/components/ui/Tooltip';
import { fechaISO, fechaLocalInput, fechaRegistroISO } from '@/features/tareas/fechas';

interface FlujoAsuntoProps {
  pasos: AsuntoPasoAPI[];
  flujoEstado: 'activo' | 'completado';
  isLoading?: boolean;
  canAdvance?: boolean;
  canSave?: boolean;
  readOnlyReason?: string;
  onAdvance: (pasoCodigo: string, datos: Record<string, unknown>, expectedUpdatedAt?: string) => Promise<unknown>;
  onSave?: (pasoCodigo: string, datos: Record<string, unknown>, expectedUpdatedAt: string) => Promise<AsuntoAPI>;
  onReload?: () => Promise<AsuntoAPI>;
}

function todayInBogota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function FlujoAsunto({
  pasos,
  flujoEstado,
  isLoading = false,
  canAdvance = true,
  canSave = canAdvance,
  readOnlyReason = 'Este paso está asignado a otro responsable.',
  onAdvance,
  onSave,
  onReload,
}: FlujoAsuntoProps) {
  const pasoRemoto = pasos.find((paso) => paso.estado === 'activo');
  const [pasoActivo, setPasoActivo] = useState(pasoRemoto);
  const pasosCompletados = pasos.filter((paso) => paso.estado === 'completado').length;
  const [datos, setDatos] = useState<Record<string, unknown>>(pasoActivo?.datos || {});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [pendingAction, setPendingAction] = useState<'save' | 'advance' | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const dirty = useRef(false);
  const currentStepId = useRef(pasoActivo?.id);
  const revision = useRef(pasoActivo?.updated_at);
  const busy = isLoading || pendingAction !== null;

  useEffect(() => {
    if (dirty.current && currentStepId.current !== pasoRemoto?.id) {
      setConflict(true);
      setError('El paso cambió. Tus cambios se conservan; recarga el borrador.');
      return;
    }
    if (currentStepId.current !== pasoRemoto?.id) {
      currentStepId.current = pasoRemoto?.id;
      setError('');
      setStatus('');
      setConflict(false);
      setConfirmReload(false);
    }
    if (!dirty.current) {
      setPasoActivo(pasoRemoto);
      setDatos(pasoRemoto?.datos || {});
      revision.current = pasoRemoto?.updated_at;
    }
  }, [pasoRemoto?.id, pasoRemoto?.datos, pasoRemoto?.updated_at]);

  const updateField = (key: string, value: unknown) => {
    dirty.current = true;
    setStatus('Cambios sin guardar');
    setDatos((current) => ({ ...current, [key]: value }));
  };

  const datosParaGuardar = () => Object.fromEntries(Object.entries(datos).map(([key, value]) => {
    const campo = pasoActivo?.campos.find((item) => item.clave === key);
    if (campo?.tipo === 'datetime' && typeof value === 'string' && value) {
      return [key, fechaRegistroISO(value)];
    }
    return [key, value === '' ? null : value];
  }));

  const handleSave = async () => {
    if (!pasoActivo || !onSave || !canSave || busy) return;
    if (!revision.current) {
      setError('Recarga el borrador antes de guardar.');
      setConflict(true);
      return;
    }
    setError('');
    setStatus('');
    setPendingAction('save');
    try {
      const draftData = datosParaGuardar();
      const asunto = await onSave(pasoActivo.codigo, draftData, revision.current);
      setDatos(asunto.pasos.find((paso) => paso.id === pasoActivo.id)?.datos || datos);
      revision.current = asunto.pasos.find((paso) => paso.id === pasoActivo.id)?.updated_at;
      dirty.current = false;
      setStatus('Borrador guardado');
      setConflict(false);
      setConfirmReload(false);
    } catch (requestError) {
      const detail = (requestError as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo guardar el borrador. Inténtalo de nuevo.');
      setConflict((requestError as { response?: { status?: number } }).response?.status === 409);
      setStatus('Cambios sin guardar');
    } finally {
      setPendingAction(null);
    }
  };

  const handleReload = async () => {
    if (!onReload || busy) return;
    setPendingAction('save');
    try {
      const asunto = await onReload();
      const activo = asunto.pasos.find((paso) => paso.estado === 'activo');
      setPasoActivo(activo);
      currentStepId.current = activo?.id;
      setDatos(activo?.datos || {});
      revision.current = activo?.updated_at;
      dirty.current = false;
      setError('');
      setConflict(false);
      setConfirmReload(false);
      setStatus('Borrador recargado');
    } catch {
      setError('No se pudo recargar. Tus cambios se conservan.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pasoActivo || !canAdvance || busy) return;
    setError('');
    setPendingAction('advance');
    try {
      const result = await onAdvance(pasoActivo.codigo, datosParaGuardar(), revision.current);
      dirty.current = false;
      if (result && Array.isArray((result as AsuntoAPI).pasos)) {
        const activo = (result as AsuntoAPI).pasos.find((paso) => paso.estado === 'activo');
        setPasoActivo(activo);
        currentStepId.current = activo?.id;
        setDatos(activo?.datos || {});
        revision.current = activo?.updated_at;
        setError('');
        setStatus('');
        setConflict(false);
        setConfirmReload(false);
      }
    } catch (requestError) {
      const detail = (
        requestError as { response?: { data?: { detail?: string } } }
      ).response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No fue posible avanzar el proceso.');
      setConflict((requestError as { response?: { status?: number } }).response?.status === 409);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section
      className="panel workflow-panel"
      id="paso-activo"
      tabIndex={-1}
    >
      {pasoActivo ? (
        <div className="workflow-current">
          <div className="workflow-current-heading">
            <div>
              <h3>{pasoActivo.titulo}</h3>
              <Tooltip content={pasoActivo.descripcion} />
            </div>
            <span className="workflow-position">
              Paso {pasoActivo.orden} de {pasos.length}
            </span>
          </div>

          {canSave || canAdvance ? (
            <form onSubmit={handleSubmit} className="workflow-form">
              <fieldset className="workflow-fields form-grid" disabled={busy}>
                {pasoActivo.campos.map((campo) => (
                  <div className={`field ${campo.tipo === 'textarea' || campo.tipo === 'boolean' ? 'full' : ''}`} key={campo.clave}>
                    {campo.tipo !== 'boolean' && (
                      <label htmlFor={`workflow-${campo.clave}`}>
                        {campo.etiqueta}{campo.requerido ? ' *' : ''}
                      </label>
                    )}

                    {campo.tipo === 'textarea' ? (
                      <textarea
                        id={`workflow-${campo.clave}`}
                        required={campo.requerido}
                        value={String(datos[campo.clave] || '')}
                        onChange={(event) => updateField(campo.clave, event.target.value)}
                      />
                    ) : campo.tipo === 'select' ? (
                      <select
                        id={`workflow-${campo.clave}`}
                        required={campo.requerido}
                        value={String(datos[campo.clave] || '')}
                        onChange={(event) => updateField(campo.clave, event.target.value)}
                      >
                        <option value="">Seleccionar</option>
                        {campo.opciones.map((option) => (
                          <option key={option.valor} value={option.valor}>{option.etiqueta}</option>
                        ))}
                      </select>
                    ) : campo.tipo === 'boolean' ? (
                      <label className="workflow-checkbox" htmlFor={`workflow-${campo.clave}`}>
                        <input
                          id={`workflow-${campo.clave}`}
                          type="checkbox"
                          checked={datos[campo.clave] === true}
                          onChange={(event) => updateField(campo.clave, event.target.checked)}
                        />
                        <span>{campo.etiqueta}{campo.requerido ? ' *' : ''}</span>
                      </label>
                    ) : campo.tipo === 'date' ? (
                      <div className="workflow-date-control">
                        <input
                          id={`workflow-${campo.clave}`}
                          type="date"
                          required={campo.requerido}
                          value={String(datos[campo.clave] || '')}
                          onChange={(event) => updateField(campo.clave, event.target.value)}
                        />
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => updateField(campo.clave, todayInBogota())}
                        >
                          Usar hoy
                        </button>
                      </div>
                    ) : (
                      <input
                        id={`workflow-${campo.clave}`}
                        type={campo.tipo === 'datetime' ? 'datetime-local' : campo.tipo}
                        required={campo.requerido}
                        value={campo.tipo === 'datetime' ? fechaLocalInput(String(datos[campo.clave] || '')) : String(datos[campo.clave] || '')}
                        onChange={(event) => updateField(campo.clave, campo.tipo === 'datetime' ? fechaISO(event.target.value) : event.target.value)}
                      />
                    )}
                  </div>
                ))}
              </fieldset>

              {error && <p className="form-error" role="alert">{error}</p>}
              {conflict && onReload && <div className="workflow-actions">
                {confirmReload ? <>
                  <span>¿Descartar tus cambios y recargar?</span>
                  <button className="secondary-button" type="button" disabled={busy} onClick={handleReload}>Descartar y recargar</button>
                  <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmReload(false)}>Conservar cambios</button>
                </> : <button className="secondary-button" type="button" disabled={busy} onClick={() => setConfirmReload(true)}>Recargar borrador</button>}
                <Tooltip content="El paso cambió desde que lo abriste. Recargar reemplaza tus cambios por la última versión guardada." />
              </div>}

              <div className="workflow-actions">
                {canSave && onSave && <button className="secondary-button" type="button" disabled={busy} onClick={handleSave}>
                  <Save size={16} aria-hidden="true" />
                  {pendingAction === 'save' ? 'Guardando borrador…' : 'Guardar borrador'}
                </button>}
                {canAdvance ? <button className="primary-button" type="submit" disabled={busy}>
                  {pendingAction === 'advance' ? 'Completando…' : pasoActivo.orden === pasos.length ? 'Completar ruta' : 'Completar y continuar'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button> : <Tooltip content="El abogado responsable o un administrador revisa y completa este paso." />}
                <Tooltip content="Guardar conserva los datos sin completar el paso. Completar valida los campos y continúa la ruta." />
                {status && <span className="muted small" role="status">{status}</span>}
              </div>
            </form>
          ) : (
            <p className="workflow-readonly">{readOnlyReason}</p>
          )}
        </div>
      ) : (
        <div className="workflow-current workflow-complete">
          <span className="page-eyebrow">Ruta del expediente</span>
          <h3>{flujoEstado === 'completado' ? 'Ruta inicial completada' : 'Sin acción activa'}</h3>
        </div>
      )}

      <details className="workflow-route" open>
        <summary>
          <span>
            <strong>Ruta completa</strong>
            <small>{pasosCompletados} de {pasos.length} pasos completados</small>
          </span>
          <ChevronDown size={18} aria-hidden="true" />
        </summary>

        <ol className="workflow-stepper" aria-label="Ruta del expediente">
          {pasos.map((paso) => {
            const isNext = paso.estado === 'bloqueado'
              && pasoActivo
              && paso.orden === pasoActivo.orden + 1;
            const stateLabel = paso.estado === 'completado'
              ? 'Completado'
              : paso.estado === 'activo'
                ? 'En curso'
                : isNext
                  ? 'Siguiente'
                  : 'Más adelante';

            return (
              <li key={paso.id} className={`workflow-step workflow-step-${paso.estado}`}>
                <details open={paso.estado === 'activo'}>
                  <summary aria-current={paso.estado === 'activo' ? 'step' : undefined}>
                    <span className="workflow-step-marker" aria-hidden="true">
                      {paso.estado === 'completado'
                        ? <Check size={15} />
                        : paso.estado === 'bloqueado'
                          ? <LockKeyhole size={13} />
                          : paso.orden}
                    </span>
                    <span className="workflow-step-copy">
                      <strong>{paso.titulo}</strong>
                      <small>Paso {paso.orden}</small>
                    </span>
                    <span className="workflow-step-state">{stateLabel}</span>
                    <ChevronDown className="workflow-step-chevron" size={16} aria-hidden="true" />
                  </summary>
                  <p>{paso.descripcion}</p>
                </details>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
