import { useQuery } from '@tanstack/react-query';
import { NavLink, useLocation, useSearchParams } from 'react-router';
import { Plus, Search } from 'lucide-react';

import { buscarAsuntosAPI } from '../api/asuntos';
import type { ClienteAPI, EstadoProcesalAPI, ResponsableAPI } from '../api/asuntos';
import type { AsuntosFiltros } from '@/types/asunto';
import './ListaExpedientes.css';

interface ListaExpedientesProps {
  clienteId?: string;
  asuntoActivoId?: string;
  clientes?: ClienteAPI[];
  responsables?: ResponsableAPI[];
  estados?: EstadoProcesalAPI[];
  onAbrir?: () => void;
}

export function ListaExpedientes({
  clienteId, asuntoActivoId, clientes = [], responsables = [], estados = [], onAbrir,
}: ListaExpedientesProps) {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const pageKey = clienteId ? 'asuntos_pagina' : 'pagina';
  const requestedPage = Number(params.get(pageKey) || 1);
  const pagina = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filtros: AsuntosFiltros = clienteId ? {
    cliente_id: clienteId, pagina, por_pagina: 10,
  } : {
    pagina, por_pagina: 25,
    q: params.get('q') || undefined,
    cliente_id: params.get('cliente_id') || undefined,
    responsable_id: params.get('responsable_id') || undefined,
    estado_id: params.get('estado_id') || undefined,
    sin_responsable: params.get('sin_responsable') === 'true' || undefined,
  };
  const query = useQuery({
    queryKey: ['asuntos', 'lista', filtros],
    queryFn: () => buscarAsuntosAPI(filtros),
    retry: false,
  });
  const data = query.data;
  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.por_pagina)) : 1;
  const hasFilters = Boolean(filtros.q || filtros.cliente_id || filtros.responsable_id || filtros.estado_id || filtros.sin_responsable);

  const changePage = (next: number) => {
    const updated = new URLSearchParams(params);
    updated.set(pageKey, String(next));
    setParams(updated);
  };
  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const updated = new URLSearchParams();
    for (const name of ['q', 'cliente_id', 'estado_id']) {
      const value = String(form.get(name) || '').trim();
      if (value) updated.set(name, value);
    }
    const responsable = String(form.get('responsable_id') || '');
    if (responsable === 'sin_asignar') updated.set('sin_responsable', 'true');
    else if (responsable) updated.set('responsable_id', responsable);
    setParams(updated);
  };

  return <section className="panel expedientes-lista" aria-label={clienteId ? 'Asuntos del cliente' : 'Expedientes'}>
    <div className="section-title">
      {clienteId ? <h3>Asuntos {data ? `(${data.total})` : ''}</h3> : <h2>Expedientes</h2>}
      {onAbrir && <button className="primary-button" type="button" onClick={onAbrir}>
        <Plus size={16} aria-hidden="true" /> Nuevo asunto
      </button>}
    </div>
    {!clienteId && <form className="expedientes-filtros" key={params.toString()} onSubmit={applyFilters}>
      <div className="field expedientes-buscar">
        <label htmlFor="expedientes-buscar">Buscar expediente</label>
        <input id="expedientes-buscar" name="q" type="search" maxLength={160}
          defaultValue={filtros.q || ''} placeholder="Título, código, radicado o cliente" />
      </div>
      <div className="field">
        <label htmlFor="expedientes-cliente">Cliente</label>
        <select id="expedientes-cliente" name="cliente_id" defaultValue={filtros.cliente_id || ''}>
          <option value="">Todos los clientes</option>
          {filtros.cliente_id && !clientes.some((c) => c.id === filtros.cliente_id) &&
            <option value={filtros.cliente_id}>Cliente seleccionado</option>}
          {clientes.map((c) => <option value={c.id} key={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="expedientes-responsable">Responsable</label>
        <select id="expedientes-responsable" name="responsable_id"
          defaultValue={filtros.sin_responsable ? 'sin_asignar' : filtros.responsable_id || ''}>
          <option value="">Todos los responsables</option>
          <option value="sin_asignar">Sin asignar</option>
          {filtros.responsable_id && !responsables.some((r) => r.id === filtros.responsable_id) &&
            <option value={filtros.responsable_id}>Responsable seleccionado</option>}
          {responsables.map((r) => <option value={r.id} key={r.id}>{r.nombre}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="expedientes-estado">Estado</label>
        <select id="expedientes-estado" name="estado_id" defaultValue={filtros.estado_id || ''}>
          <option value="">Todos los estados</option>
          {filtros.estado_id && !estados.some((e) => e.id === filtros.estado_id) &&
            <option value={filtros.estado_id}>Estado seleccionado</option>}
          {estados.map((estado) => <option value={estado.id} key={estado.id}>{estado.nombre}</option>)}
        </select>
      </div>
      <div className="expedientes-filtro-acciones">
        <button className="secondary-button" type="submit"><Search size={16} aria-hidden="true" /> Buscar</button>
        {hasFilters && <button className="secondary-button" type="button" onClick={() => setParams({})}>Limpiar filtros</button>}
      </div>
    </form>}

    {query.isPending ? <p role="status" className="muted">Consultando expedientes…</p>
      : query.isError && !data ? <div role="alert" className="expedientes-error">
        <h3>No pudimos consultar los expedientes</h3>
        <button className="secondary-button" type="button" onClick={() => query.refetch()}>Reintentar</button>
      </div> : data && <>
        {query.isError && <div role="status" className="expedientes-error">
          Mostrando la última información disponible.
          <button className="secondary-button" type="button" onClick={() => query.refetch()}>Reintentar</button>
        </div>}
        <p className="muted small" role="status">
          {data.total} {data.total === 1 ? 'expediente' : 'expedientes'}
          {query.isFetching ? ' · Actualizando…' : ''}
        </p>
        {data.items.length ? <ul className="expedientes-resultados">
          {data.items.map((asunto) => <li key={asunto.id}>
            <NavLink className={`expediente-resultado ${asuntoActivoId === asunto.id ? 'activo' : ''}`}
              to={{ pathname: `/oficina/asuntos/${asunto.id}`, search: location.search }}>
              <div className="expediente-identidad">
                <strong>{asunto.titulo}</strong>
                <span className="muted small">{asunto.codigo_interno} · {asunto.cliente_nombre}</span>
                {asunto.radicado_oficial && <span className="muted small">Radicado oficial · {asunto.radicado_oficial}</span>}
              </div>
              <div className="expediente-contexto">
                <span>{asunto.responsable_nombre || 'Sin responsable activo'}</span>
                <span className={`badge ${['mint', 'warning', 'danger', 'neutral'].includes(asunto.estado_color || '') ? asunto.estado_color : 'neutral'}`}>
                  {asunto.estado_nombre || 'Sin estado registrado'}
                </span>
              </div>
            </NavLink>
          </li>)}
        </ul> : <div className="expedientes-error">
          <h3>{data.total ? 'Esta página ya no tiene expedientes' : 'Sin expedientes para esta consulta'}</h3>
          {pagina > 1 && <button className="secondary-button" type="button" onClick={() => changePage(1)}>Ir a la primera página</button>}
        </div>}
        <nav className="expedientes-paginacion" aria-label={clienteId ? 'Páginas de asuntos del cliente' : 'Páginas de expedientes'}>
          <button className="secondary-button" type="button" disabled={pagina === 1 || query.isFetching} onClick={() => changePage(pagina - 1)}>Anterior</button>
          <span className="muted small">Página {pagina} de {totalPaginas}</span>
          <button className="secondary-button" type="button" disabled={pagina >= totalPaginas || query.isFetching} onClick={() => changePage(pagina + 1)}>Siguiente</button>
        </nav>
      </>}
  </section>;
}
