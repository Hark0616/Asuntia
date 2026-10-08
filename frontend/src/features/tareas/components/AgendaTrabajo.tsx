import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowRight, CalendarClock } from 'lucide-react';

import { Tooltip } from '@/components/ui/Tooltip';
import { fetchAgenda, type AlcanceTrabajo } from '../api/tareas';
import { fechaTrabajo } from '../fechas';

function dayOffset(offset: number) {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  return new Date(day.getTime() - day.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function AgendaTrabajo({ alcance }: { alcance: AlcanceTrabajo }) {
  const [desde, setDesde] = useState(() => dayOffset(-7));
  const [hasta, setHasta] = useState(() => dayOffset(30));
  const difference = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
  const valid = Boolean(desde && hasta && difference >= 0 && difference < 92);
  const desdeISO = desde ? new Date(`${desde}T00:00:00`).toISOString() : '';
  const end = hasta ? new Date(`${hasta}T00:00:00`) : null;
  if (end) end.setDate(end.getDate() + 1);
  const hastaISO = end?.toISOString() || '';
  const query = useQuery({
    queryKey: ['tareas', 'agenda', alcance, desdeISO, hastaISO],
    queryFn: () => fetchAgenda(alcance, desdeISO, hastaISO),
    enabled: valid, retry: 1, staleTime: 30_000,
  });
  return <div className="agenda-work">
    <div className="agenda-window">
      <div className="field"><label htmlFor="agenda-from">Desde</label><input id="agenda-from" type="date" value={desde} onChange={(event) => setDesde(event.target.value)} /></div>
      <div className="field"><label htmlFor="agenda-to">Hasta</label><input id="agenda-to" type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} /></div>
      <Tooltip content="Vencimientos de tareas abiertas y audiencias registradas en el expediente. El intervalo admite hasta 92 días; las fechas se introducen en hora local." />
      <button className="secondary-button" type="button" disabled={!valid || query.isFetching} onClick={() => query.refetch()}>{query.isFetching ? 'Actualizando…' : 'Actualizar agenda'}</button>
    </div>
    {!valid && <p className="form-error" role="alert">Elige un intervalo de hasta 92 días, con la fecha final igual o posterior al inicio.</p>}
    {valid && query.isLoading && <p className="muted" role="status">Consultando agenda…</p>}
    {valid && query.isError && <div className="panel work-empty" role="alert">
      <h3>{query.data ? 'Mostrando la última agenda disponible.' : 'No pudimos consultar la agenda'}</h3>
      <button className="secondary-button" type="button" onClick={() => query.refetch()}>Reintentar agenda</button>
    </div>}
    {valid && query.data?.items.length === 0 && <div className="panel work-empty"><CalendarClock size={24} aria-hidden="true" /><h3>Sin fechas en este intervalo</h3></div>}
    {valid && query.data && query.data.items.length > 0 && <>
      <p className="muted small" role="status">{query.data.total} {query.data.total === 1 ? 'fecha' : 'fechas'}{query.data.total > query.data.items.length ? ` · mostrando ${query.data.items.length}` : ''}</p>
      <div className="panel work-list">{query.data.items.map((item) => <Link key={item.id} className="work-item"
        to={`/oficina/asuntos/${item.asunto.id}${item.origen === 'audiencia' ? '#paso-activo' : '#tareas-expediente'}`}
        aria-label={`Abrir ${item.asunto.radicado}: ${item.titulo}`}>
        <CalendarClock size={18} aria-hidden="true" />
        <span className="work-item-body">
          <span className="work-item-context"><strong>{item.asunto.cliente.nombre}</strong><span>{item.asunto.radicado}</span></span>
          <strong className="work-item-title">{item.titulo}</strong>
          <span className="muted small">{item.origen === 'audiencia' ? 'Audiencia' : 'Vencimiento de tarea'} · {fechaTrabajo(item.fecha)}</span>
          <span className="muted small">Responsable · {item.responsable.nombre}</span>
        </span>
        <span className="work-item-action">Abrir<ArrowRight size={16} aria-hidden="true" /></span>
      </Link>)}</div>
    </>}
  </div>;
}
