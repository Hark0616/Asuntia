import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock3, Eye, History, Send } from 'lucide-react';

import { actualizarVisibilidadNovedadAPI, crearNovedadAPI } from '@/features/asuntos/api/asuntos';
import type { Novedad } from '@/types/api';
import { Tooltip } from '@/components/ui/Tooltip';

interface ActividadExpedienteProps {
  asuntoId: string;
  novedades: Novedad[];
  canPublish: boolean;
}

function requestDetail(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

export function ActividadExpediente({ asuntoId, novedades, canPublish }: ActividadExpedienteProps) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [visibilidad, setVisibilidad] = useState<'internal' | 'client'>('internal');
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    queryClient.invalidateQueries({ queryKey: ['portal', 'asuntos'] });
  };
  const crear = useMutation({
    mutationFn: () => crearNovedadAPI(asuntoId, {
      titulo: 'Avance procesal',
      descripcion: texto,
      publicado_al_cliente: canPublish && visibilidad === 'client',
    }),
    onSuccess: () => {
      setTexto('');
      setVisibilidad('internal');
      refresh();
    },
  });
  const publicar = useMutation({
    mutationFn: ({ id, publicado }: { id: string; publicado: boolean }) =>
      actualizarVisibilidadNovedadAPI(id, { publicado_al_cliente: publicado }),
    onSuccess: refresh,
  });

  return <>
    <form className="panel expediente-note-composer" onSubmit={(event) => {
      event.preventDefault();
      if (texto.trim() && !crear.isPending) crear.mutate();
    }}>
      <div className="section-title">
        <h3>Registrar nota</h3>
        <Eye size={17} aria-hidden="true" />
      </div>
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="update-body">Contenido</label>
          <textarea id="update-body" required disabled={crear.isPending}
            value={texto} onChange={(event) => { setTexto(event.target.value); crear.reset(); }}
            placeholder="Nota sobre el expediente..." />
        </div>
        {canPublish && <div className="field">
          <div className="row"><label htmlFor="update-visibility">Visibilidad</label><Tooltip content="La nota permanece interna hasta que un abogado responsable o administrador autoriza compartirla." /></div>
          <select id="update-visibility" value={visibilidad} disabled={crear.isPending}
            onChange={(event) => setVisibilidad(event.target.value as 'internal' | 'client')}>
            <option value="internal">Interno (Solo firma)</option>
            <option value="client">Compartir con el cliente</option>
          </select>
        </div>}
        <div className="field note-submit">
          <button className="primary-button" type="submit" disabled={crear.isPending}>
            <Send size={16} aria-hidden="true" />
            {crear.isPending ? 'Guardando…' : 'Registrar nota'}
          </button>
        </div>
      </div>
      {crear.isError && <p className="form-error" role="alert">{requestDetail(crear.error, 'No pudimos guardar la nota. Inténtalo de nuevo.')}</p>}
      {crear.isSuccess && <p className="muted small" role="status">Nota registrada</p>}
    </form>

    <div className="panel">
      <div className="section-title">
        <h3>Actividad del expediente</h3>
        <History size={17} aria-hidden="true" />
      </div>
      <div className="timeline">
        {novedades.length ? novedades.map((novedad) => {
          const isCurrent = publicar.variables?.id === novedad.id;
          return <div key={novedad.id} className="timeline-item">
            <div className="timeline-dot"><Clock3 size={14} aria-hidden="true" /></div>
            <div className="timeline-body">
              <div className="row between">
                <strong>{novedad.titulo}</strong>
                <span className="muted small">{new Intl.DateTimeFormat('es-CO', {
                  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
                }).format(new Date(novedad.created_at))}</span>
              </div>
              <span className="muted small">{novedad.tipo === 'nota' ? 'Nota de la firma' : 'Actividad del sistema'}</span>
              <p>{novedad.descripcion}</p>
              <div className="activity-publication">
                <span className={`badge ${novedad.publicado_al_cliente ? 'neutral' : 'warning'}`}>
                  {novedad.publicado_al_cliente ? 'Cliente' : 'Interno'}
                </span>
                {canPublish && novedad.tipo === 'nota' && <button className="secondary-button" type="button"
                  disabled={publicar.isPending}
                  aria-label={`${novedad.publicado_al_cliente ? 'Retirar del portal' : 'Publicar al cliente'}: ${novedad.titulo}`}
                  onClick={() => publicar.mutate({ id: novedad.id, publicado: !novedad.publicado_al_cliente })}>
                  {publicar.isPending && isCurrent ? 'Actualizando…' : novedad.publicado_al_cliente ? 'Retirar del portal' : 'Publicar al cliente'}
                </button>}
                {novedad.tipo !== 'nota' && <Tooltip content={novedad.tipo === 'documento_incorporado'
                  ? 'La visibilidad se gestiona desde el documento de origen.'
                  : 'Esta actividad se registra al completar el paso.'} />}
              </div>
              {isCurrent && publicar.isError && <p className="form-error" role="alert">{requestDetail(publicar.error, 'No se pudo cambiar la visibilidad. Inténtalo de nuevo.')}</p>}
              {isCurrent && publicar.isSuccess && <span className="muted small" role="status">{publicar.variables.publicado ? 'Nota publicada' : 'Nota retirada del portal'}</span>}
            </div>
          </div>;
        }) : <div className="muted small">Sin actividad registrada.</div>}
      </div>
    </div>
  </>;
}
