import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronDown, LockKeyhole } from 'lucide-react';

import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';

interface FlujoAsuntoProps {
  pasos: AsuntoPasoAPI[];
  flujoEstado: 'activo' | 'completado';
  isLoading?: boolean;
  canAdvance?: boolean;
  readOnlyReason?: string;
  onAdvance: (pasoCodigo: string, datos: Record<string, unknown>) => Promise<unknown>;
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
  readOnlyReason = 'Este paso está asignado a otro responsable.',
  onAdvance,
}: FlujoAsuntoProps) {
  const pasoActivo = pasos.find((paso) => paso.estado === 'activo');
  const pasosCompletados = pasos.filter((paso) => paso.estado === 'completado').length;
  const [datos, setDatos] = useState<Record<string, unknown>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    setDatos({});
    setError('');
  }, [pasoActivo?.id]);

  const updateField = (key: string, value: unknown) => {
    setDatos((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pasoActivo) return;
    setError('');
    try {
      await onAdvance(pasoActivo.codigo, datos);
    } catch (requestError) {
      const detail = (
        requestError as { response?: { data?: { detail?: string } } }
      ).response?.data?.detail;
      setError(detail || 'No fue posible avanzar el proceso.');
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
              <span className="page-eyebrow">Acción actual</span>
              <h3>{pasoActivo.titulo}</h3>
              <p className="muted">{pasoActivo.descripcion}</p>
            </div>
            <span className="workflow-position">
              Paso {pasoActivo.orden} de {pasos.length}
            </span>
          </div>

          {canAdvance ? (
            <form onSubmit={handleSubmit} className="workflow-form">
              <div className="form-grid">
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
                        value={String(datos[campo.clave] || '')}
                        onChange={(event) => updateField(campo.clave, event.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {error && <p className="form-error" role="alert">{error}</p>}

              <div className="workflow-actions">
                <button className="primary-button" type="submit" disabled={isLoading}>
                  {isLoading ? 'Guardando…' : pasoActivo.orden === pasos.length ? 'Completar ruta' : 'Completar y continuar'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
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
