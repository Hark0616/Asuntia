import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  RefreshCw,
} from 'lucide-react';

import { Tooltip } from '@/components/ui/Tooltip';
import { fetchMiTrabajo, type AlcanceTrabajo } from '../api/tareas';
import { AgendaTrabajo } from './AgendaTrabajo';
import { fechaTrabajo } from '../fechas';
import './MiTrabajo.css';

interface MiTrabajoProps {
  isAdmin: boolean;
}

export function MiTrabajo({ isAdmin }: MiTrabajoProps) {
  const [alcance, setAlcance] = useState<AlcanceTrabajo>('mio');
  const [vista, setVista] = useState<'pendientes' | 'agenda'>('pendientes');
  const {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['tareas', 'mi-trabajo', alcance],
    queryFn: () => fetchMiTrabajo(alcance),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: vista === 'pendientes',
  });
  const total = data?.total || 0;
  const totalLabel = alcance === 'equipo'
    ? total === 1
      ? '1 pendiente del equipo.'
      : `${total} pendientes del equipo.`
    : total === 1
      ? '1 pendiente asignado a ti.'
      : `${total} pendientes asignados a ti.`;

  return (
    <div className="workbench">
      <div className="toolbar workbench-toolbar">
        <div>
          <h2>Mi trabajo</h2>
          {vista === 'pendientes' && <p className="muted">{isLoading ? 'Consultando trabajo…' : error && !data ? 'Bandeja no disponible.' : totalLabel}</p>}
        </div>
        {vista === 'pendientes' && <button
          className="secondary-button"
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {isFetching ? 'Actualizando…' : 'Actualizar'}
        </button>}
      </div>

      <div className="scope-tabs" role="group" aria-label="Vista de trabajo">
        <button className={vista === 'pendientes' ? 'active' : ''} type="button" aria-pressed={vista === 'pendientes'} onClick={() => setVista('pendientes')}>Pendientes</button>
        <button className={vista === 'agenda' ? 'active' : ''} type="button" aria-pressed={vista === 'agenda'} onClick={() => setVista('agenda')}>Agenda</button>
      </div>

      {isAdmin && (
        <div className="scope-tabs" role="group" aria-label="Alcance del trabajo">
          <button
            className={alcance === 'mio' ? 'active' : ''}
            type="button"
            aria-pressed={alcance === 'mio'}
            onClick={() => setAlcance('mio')}
          >
            Asignadas a mí
          </button>
          <button
            className={alcance === 'equipo' ? 'active' : ''}
            type="button"
            aria-pressed={alcance === 'equipo'}
            onClick={() => setAlcance('equipo')}
          >
            Equipo
          </button>
        </div>
      )}

      {vista === 'agenda' ? <AgendaTrabajo alcance={alcance} /> : <>

      {isLoading && (
        <div className="panel work-list" aria-label="Cargando trabajo">
          {[1, 2, 3].map((item) => (
            <div className="work-item work-item-skeleton" key={item}>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      )}

      {error && !data && (
        <div className="panel work-empty" role="alert">
          <AlertCircle size={22} aria-hidden="true" />
          <div>
            <h3>No pudimos cargar tu trabajo</h3>
            <p className="muted small">Reintenta para consultar la bandeja.</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => refetch()}>
            Reintentar
          </button>
        </div>
      )}

      {error && data && (
        <div className="work-stale-notice" role="status">
          Mostrando la última información disponible.
        </div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="panel work-empty">
          <BriefcaseBusiness size={24} aria-hidden="true" />
          <div>
            <h3>Sin tareas pendientes</h3>
          </div>
        </div>
      )}

      {!isLoading && data && data.items.length > 0 && (
        <div className="panel work-list">
          {data.items.map((tarea) => (
            <div
              className={`work-item-row${tarea.consecuencia ? ' has-tooltip' : ''}`}
              key={tarea.id}
            >
              <Link
                className="work-item"
                to={`/oficina/asuntos/${tarea.asunto.id}${tarea.tipo === 'completar_paso' ? '#paso-activo' : '#tareas-expediente'}`}
                aria-label={`Abrir ${tarea.asunto.radicado}: ${tarea.titulo}`}
              >
                <span className="work-item-status" aria-hidden="true" />
                <span className="work-item-body">
                  <span className="work-item-context">
                    <strong>{tarea.asunto.cliente.nombre}</strong>
                    <span>{tarea.asunto.radicado}</span>
                  </span>
                  <strong className="work-item-title">{tarea.titulo}</strong>
                  <span className="muted work-item-instruction">
                    {tarea.instruccion}
                  </span>
                  {(tarea.prioridad === 'alta'
                    || tarea.prioridad === 'urgente'
                    || tarea.vence_en) && (
                    <span className="work-item-meta">
                      {(tarea.prioridad === 'alta' || tarea.prioridad === 'urgente') && (
                        <span className={`badge ${tarea.prioridad === 'urgente' ? 'danger' : 'warning'}`}>
                          Prioridad {tarea.prioridad}
                        </span>
                      )}
                      {tarea.vence_en && (
                        <span className="muted small">
                          <CalendarClock size={14} aria-hidden="true" />
                          Vence {fechaTrabajo(tarea.vence_en)}
                        </span>
                      )}
                    </span>
                  )}
                  {alcance === 'equipo' && (
                    <span className="muted small">
                      Responsable · {tarea.responsable.nombre}
                    </span>
                  )}
                </span>
                <span className="work-item-action">
                  Abrir
                  <ArrowRight size={16} aria-hidden="true" />
                </span>
              </Link>
              {tarea.consecuencia && <Tooltip content={tarea.consecuencia} />}
            </div>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
