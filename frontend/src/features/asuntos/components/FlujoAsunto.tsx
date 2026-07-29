import { useEffect, useState } from 'react';
import { ArrowRight, Check, LockKeyhole } from 'lucide-react';

import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';

interface FlujoAsuntoProps {
  pasos: AsuntoPasoAPI[];
  flujoEstado: 'activo' | 'completado';
  isLoading?: boolean;
  canAdvance?: boolean;
  onAdvance: (pasoCodigo: string, datos: Record<string, unknown>) => Promise<unknown>;
}

export function FlujoAsunto({
  pasos,
  flujoEstado,
  isLoading = false,
  canAdvance = true,
  onAdvance,
}: FlujoAsuntoProps) {
  const pasoActivo = pasos.find((paso) => paso.estado === 'activo');
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
    <section className="panel workflow-panel">
      <div className="section-title">
        <div>
          <h3>Ruta del expediente</h3>
          <span className="muted small">
            {flujoEstado === 'completado' ? 'Ruta inicial completada' : `Paso ${pasoActivo?.orden || 1} de ${pasos.length}`}
          </span>
        </div>
      </div>

      <ol className="workflow-stepper" aria-label="Ruta del expediente">
        {pasos.map((paso) => (
          <li key={paso.id} className={`workflow-step workflow-step-${paso.estado}`}>
            <span className="workflow-step-marker" aria-hidden="true">
              {paso.estado === 'completado' ? <Check size={15} /> : paso.estado === 'bloqueado' ? <LockKeyhole size={13} /> : paso.orden}
            </span>
            <span>
              <strong>{paso.titulo}</strong>
              <small>{paso.estado === 'completado' ? 'Completado' : paso.estado === 'activo' ? 'En curso' : 'Pendiente'}</small>
            </span>
          </li>
        ))}
      </ol>

      {pasoActivo && canAdvance && (
        <form onSubmit={handleSubmit} className="workflow-form">
          <div>
            <h3>{pasoActivo.titulo}</h3>
            <p className="muted small">{pasoActivo.descripcion}</p>
          </div>

          <div className="form-grid">
            {pasoActivo.campos.map((campo) => (
              <div className={`field ${campo.tipo === 'textarea' ? 'full' : ''}`} key={campo.clave}>
                <label htmlFor={`workflow-${campo.clave}`}>
                  {campo.etiqueta}{campo.requerido ? ' *' : ''}
                </label>

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
                  <label className="workflow-checkbox">
                    <input
                      id={`workflow-${campo.clave}`}
                      type="checkbox"
                      checked={datos[campo.clave] === true}
                      onChange={(event) => updateField(campo.clave, event.target.checked)}
                    />
                    <span>Confirmar</span>
                  </label>
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
              <ArrowRight size={16} />
            </button>
          </div>
        </form>
      )}

      {pasoActivo && !canAdvance && (
        <div className="workflow-form">
          <div>
            <h3>{pasoActivo.titulo}</h3>
            <p className="muted small">{pasoActivo.descripcion}</p>
          </div>
        </div>
      )}
    </section>
  );
}
