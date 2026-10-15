import { FileClock, UserRound } from 'lucide-react';

import { Tooltip } from '@/components/ui/Tooltip';
import { DocumentosTab } from '@/features/documentos/components/DocumentosTab';
import type { AsuntoPortalAPI } from '@/types/portal';
import '../portal.css';

interface PortalClienteProps {
  asuntos: AsuntoPortalAPI[];
  clienteNombre: string;
  selectedId: string;
  onSelect: (id: string) => void;
}

const fechaAvance = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
  timeStyle: 'short',
});

const fechaApertura = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  dateStyle: 'medium',
});

export function PortalCliente({
  asuntos,
  clienteNombre,
  selectedId,
  onSelect,
}: PortalClienteProps) {
  const asunto = asuntos.find((item) => item.id === selectedId) || asuntos[0];

  if (!asunto) {
    return (
      <section className="portal-client portal-empty" aria-labelledby="portal-empty-title">
        <FileClock size={24} aria-hidden="true" />
        <h2 id="portal-empty-title">Sin asuntos disponibles</h2>
        <Tooltip content="Si esperabas encontrar un asunto, consulta a tu firma para verificar el acceso." />
      </section>
    );
  }

  const avances = [...asunto.novedades].sort((a, b) => (
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ));
  const ultimoAvance = avances[0];
  const anteriores = avances.slice(1);

  return (
    <section className="portal-client" aria-labelledby="portal-title">
      <header className="portal-heading">
        <div>
          <span className="badge neutral">{asunto.radicado}</span>
          <h2 id="portal-title">Tu asunto</h2>
          <p className="muted">{clienteNombre}</p>
        </div>
        {asuntos.length > 1 && (
          <div className="field portal-selector">
            <label htmlFor="portal-asunto">Consultar asunto</label>
            <select
              id="portal-asunto"
              value={asunto.id}
              onChange={(event) => onSelect(event.target.value)}
            >
              {asuntos.map((item) => (
                <option key={item.id} value={item.id}>{item.radicado}</option>
              ))}
            </select>
          </div>
        )}
      </header>

      <section className="portal-summary" aria-labelledby="portal-latest-title">
        <div className="portal-latest">
          <h3 id="portal-latest-title">
            Último avance
            <Tooltip content="Información que la firma ha autorizado para tu consulta. Las tareas internas no se muestran aquí." />
          </h3>
          {ultimoAvance ? (
            <>
              <time className="muted small" dateTime={ultimoAvance.created_at}>
                {fechaAvance.format(new Date(ultimoAvance.created_at))}
              </time>
              <h4>{ultimoAvance.titulo}</h4>
              <p className="portal-copy">{ultimoAvance.descripcion}</p>
            </>
          ) : (
            <p className="portal-no-updates">Aún no hay avances publicados.</p>
          )}
        </div>
        <dl className="portal-context">
          <div>
            <dt><UserRound size={16} aria-hidden="true" /> Responsable</dt>
            <dd>{asunto.responsable_nombre || 'Por asignar'}</dd>
          </div>
          <div>
            <dt><FileClock size={16} aria-hidden="true" /> Apertura del expediente</dt>
            <dd>
              <time dateTime={asunto.fecha_apertura}>
                {fechaApertura.format(new Date(`${asunto.fecha_apertura}T12:00:00-05:00`))}
              </time>
            </dd>
          </div>
        </dl>
      </section>

      {anteriores.length > 0 && (
        <section className="portal-history" aria-labelledby="portal-history-title">
          <h3 id="portal-history-title">Avances anteriores</h3>
          <ol className="portal-history-list">
            {anteriores.map((avance) => (
              <li key={avance.id}>
                <time className="muted small" dateTime={avance.created_at}>
                  {fechaAvance.format(new Date(avance.created_at))}
                </time>
                <div>
                  <h4>{avance.titulo}</h4>
                  <p className="portal-copy">{avance.descripcion}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <DocumentosTab key={asunto.id} asuntoId={asunto.id} isReadOnly />
    </section>
  );
}
