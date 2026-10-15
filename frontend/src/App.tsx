import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Navigate,
  Link,
  NavLink,
  matchPath,
  useLocation,
  useNavigate,
} from 'react-router';
import { 
  BriefcaseBusiness,
  Plus, 
  Save, 
  HardDrive,
  UsersRound,
} from 'lucide-react';
import { 
  fetchAsunto,
  incorporarGuiaAPI,
  fetchAsuntosPortalAPI,
  fetchEstadosAPI, 
  fetchClientesAPI,
  fetchResponsablesAPI,
  abrirAsuntoAPI,
  avanzarPasoAPI,
  guardarBorradorPasoAPI,
  actualizarEstadoAPI, 
  asignarResponsableClienteAPI,
  asignarResponsableAsuntoAPI,
  EstadoProcesalAPI,
  AperturaAsuntoPayload,
} from '@/features/asuntos/api/asuntos';
import { ClienteOTPLogin } from '@/features/auth/components/ClienteOTPLogin';
import { firmaInicial } from '@/features/auth/firmaAcceso';
import { OficinaLogin } from '@/features/auth/components/OficinaLogin';
import { fetchCurrentUserAPI, logoutAPI } from '@/features/auth/api/auth';
import type { User } from '@/types/api';
import { Tooltip } from '@/components/ui/Tooltip';
import { AperturaAsuntoModal } from '@/components/ui/AperturaAsuntoModal';
import { DocumentosTab } from '@/features/documentos/components/DocumentosTab';
import { ConfiguracionAlmacenamiento } from '@/features/firma/components/ConfiguracionAlmacenamiento';
import { FlujoAsunto } from '@/features/asuntos/components/FlujoAsunto';
import { ActividadExpediente } from '@/features/asuntos/components/ActividadExpediente';
import { ResponsableAsignacion } from '@/features/asuntos/components/ResponsableAsignacion';
import { UserMenu } from '@/components/layout/UserMenu';
import { MiTrabajo } from '@/features/tareas/components/MiTrabajo';
import { TareasAsunto } from '@/features/tareas/components/TareasAsunto';
import { PortalCliente } from '@/features/portal-cliente/components/PortalCliente';
import { ListaExpedientes } from '@/features/asuntos/components/ListaExpedientes';
import { formatAsuntosCount } from '@/lib/formatAsuntos';

export default function App() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<User | null | undefined>(undefined);
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [firmaSlug, setFirmaSlug] = useState(() => firmaInicial(location.search, import.meta.env.VITE_FIRMA_SLUG));
  const [casoIdSeleccionado, setCasoIdSeleccionado] = useState<string>('');
  const [aperturaAbierta, setAperturaAbierta] = useState(false);
  const [clienteInicialAperturaId, setClienteInicialAperturaId] = useState('');
  const asuntoRouteMatch = matchPath(
    '/oficina/asuntos/:asuntoId',
    location.pathname,
  );
  const seccionFirma = location.pathname === '/oficina/ajustes/almacenamiento'
    ? 'config_almacenamiento'
    : location.pathname === '/oficina/asuntos' || asuntoRouteMatch
      ? 'expedientes'
      : 'trabajo';
  const validOfficeRoute = (
    location.pathname === '/oficina/trabajo'
    || location.pathname === '/oficina/asuntos'
    || Boolean(asuntoRouteMatch)
    || (
      usuarioAutenticado?.rol === 'administrador'
      && location.pathname === '/oficina/ajustes/almacenamiento'
    )
  );

  const { data: sessionUser, isLoading: sessionLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchCurrentUserAPI,
    retry: false,
  });

  React.useEffect(() => {
    if (sessionUser) {
      setUsuarioAutenticado(sessionUser);
      setView(sessionUser.rol === 'cliente' ? 'cliente' : 'firma');
    } else if (!sessionLoading) {
      setUsuarioAutenticado(null);
    }
  }, [sessionUser, sessionLoading]);

  // Consultas API protegidas por la sesión y el rol.
  const authenticated = Boolean(usuarioAutenticado);
  const officeUser = authenticated && usuarioAutenticado?.rol !== 'cliente';
  const asuntoIdRuta = asuntoRouteMatch?.params.asuntoId;
  const detalleQuery = useQuery({
    queryKey: ['asuntos', 'detalle', asuntoIdRuta],
    queryFn: () => fetchAsunto(asuntoIdRuta!),
    retry: false,
    enabled: officeUser && Boolean(asuntoIdRuta),
  });
  const detalle = detalleQuery.data;
  const portalQuery = useQuery({
    queryKey: ['portal', 'asuntos'],
    queryFn: fetchAsuntosPortalAPI,
    retry: 1,
    enabled: authenticated && usuarioAutenticado?.rol === 'cliente',
  });
  const { data: estadosAPI } = useQuery({
    queryKey: ['estados'],
    queryFn: fetchEstadosAPI,
    retry: 1,
    enabled: officeUser,
  });
  const clientesQuery = useQuery({
    queryKey: ['clientes'],
    queryFn: fetchClientesAPI,
    retry: 1,
    enabled: officeUser,
  });
  const { data: clientesAPI } = clientesQuery;
  const { data: responsablesAPI } = useQuery({
    queryKey: ['equipo', 'responsables'],
    queryFn: fetchResponsablesAPI,
    retry: 1,
    enabled: officeUser,
  });
  const puedeGestionarAsignaciones = usuarioAutenticado?.rol === 'administrador';

  // Mutaciones
  const mutacionApertura = useMutation({
    mutationFn: (payload: AperturaAsuntoPayload) => abrirAsuntoAPI(payload),
    onSuccess: (newAsunto) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      setCasoIdSeleccionado(newAsunto.id);
      setAperturaAbierta(false);
      setClienteInicialAperturaId('');
      queryClient.setQueryData(['asuntos', 'detalle', newAsunto.id], newAsunto);
      navigate(`/oficina/asuntos/${newAsunto.id}`);
    }
  });

  const mutacionGuia = useMutation({
    mutationFn: (asuntoId: string) => incorporarGuiaAPI(asuntoId, 'insolvencia_persona_natural:v2'),
    onSuccess: (asunto) => {
      queryClient.setQueryData(['asuntos', 'detalle', asunto.id], asunto);
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    },
  });
  const mutacionAvanzarPaso = useMutation({
    mutationFn: ({ asuntoId, pasoCodigo, datos, expectedUpdatedAt }: { asuntoId: string; pasoCodigo: string; datos: Record<string, unknown>; expectedUpdatedAt?: string }) =>
      avanzarPasoAPI(asuntoId, { paso_codigo: pasoCodigo, datos, expected_updated_at: expectedUpdatedAt }),
    onSuccess: (asunto) => {
      queryClient.setQueryData(['asuntos', 'detalle', asunto.id], asunto);
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    },
  });

  const mutacionBorrador = useMutation({
    mutationFn: ({ asuntoId, pasoCodigo, datos, expectedUpdatedAt }: { asuntoId: string; pasoCodigo: string; datos: Record<string, unknown>; expectedUpdatedAt: string }) =>
      guardarBorradorPasoAPI(asuntoId, { paso_codigo: pasoCodigo, datos, expected_updated_at: expectedUpdatedAt }),
    onSuccess: (asunto) => {
      queryClient.setQueryData(['asuntos', 'detalle', asunto.id], asunto);
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });


  const mutacionEstado = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { estado_id: string | null } }) =>
      actualizarEstadoAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  const mutacionResponsableCliente = useMutation({
    mutationFn: ({
      clienteId,
      responsableId,
    }: {
      clienteId: string;
      responsableId: string;
    }) => asignarResponsableClienteAPI(clienteId, responsableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['asuntos', 'detalle'] });
    },
  });

  const mutacionResponsableAsunto = useMutation({
    mutationFn: ({
      asuntoId,
      responsableId,
    }: {
      asuntoId: string;
      responsableId: string;
    }) => asignarResponsableAsuntoAPI(asuntoId, responsableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    },
  });

  const clientes = (clientesAPI || []).map((cli) => ({
    id: cli.id, nombre: cli.nombre, asuntosRegistrados: cli.asuntos_count,
    responsableNombre: (responsablesAPI || []).find((r) => r.id === cli.responsable_id)?.nombre || 'Sin asignar',
  }));
  const clienteActivo = detalle ? {
    id: detalle.cliente.id, nombre: detalle.cliente.nombre, email: detalle.cliente.email,
    identificacion: detalle.cliente.numero_documento, responsableId: detalle.cliente.responsable_id,
  } : null;
  const casoActivo = detalle ? {
    id: detalle.id, nombre: detalle.titulo, codigo: detalle.codigo_interno,
    radicadoOficial: detalle.radicado_oficial, rutaCodigo: detalle.ruta_codigo,
    estadoId: detalle.estado?.id, estadoBadge: detalle.estado?.nombre || 'Sin estado registrado',
    estadoTipo: detalle.estado?.color_tipo || 'neutral', estadoDescripcion: detalle.estado?.descripcion,
    abogadoId: detalle.abogado_id, pasos: detalle.pasos, flujoEstado: detalle.flujo_estado,
    novedades: detalle.novedades,
  } : null;
  const puedeDecidirCaso = usuarioAutenticado?.rol === 'administrador'
    || (usuarioAutenticado?.rol === 'abogado' && casoActivo?.abogadoId === usuarioAutenticado.id);

  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');

  React.useEffect(() => {
    setEstadoSeleccionadoId(casoActivo?.estadoId || '');
  }, [casoActivo?.id, casoActivo?.estadoId]);

  React.useEffect(() => {
    if (!casoActivo || !['#paso-activo', '#tareas-expediente'].includes(location.hash)) return;
    const frame = window.requestAnimationFrame(() => {
      const activeStep = document.getElementById(location.hash.slice(1));
      activeStep?.scrollIntoView({ block: 'start' });
      activeStep?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [casoActivo?.id, location.hash]);

  const handleGuardarEstado = (e: React.FormEvent) => {
    e.preventDefault();
    if (casoActivo) {
      mutacionEstado.mutate({
        asuntoId: casoActivo.id,
        payload: {
          estado_id: estadoSeleccionadoId || null
        }
      });
    }
  };


  const handleAuthenticated = (user: User) => {
    queryClient.setQueryData(['auth', 'me'], user);
    setUsuarioAutenticado(user);
    setView(user.rol === 'cliente' ? 'cliente' : 'firma');
    navigate(user.rol === 'cliente' ? '/cliente' : '/oficina/trabajo');
  };

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } finally {
      queryClient.clear();
      setUsuarioAutenticado(null);
      setView('firma');
      navigate('/');
    }
  };

  if (usuarioAutenticado === undefined) {
    return (
      <div className="app-shell">
        <div className="panel" style={{ maxWidth: '420px', margin: '64px auto', textAlign: 'center' }}>
          <span className="muted small">Verificando sesión…</span>
        </div>
      </div>
    );
  }

  if (!usuarioAutenticado) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <h1>Asuntia</h1>
            </div>
          </div>
          <div className="row wrap">
            <button 
              className="secondary-button" 
              type="button"
              onClick={() => setView(view === 'cliente' ? 'firma' : 'cliente')}
              style={{ fontWeight: 600, borderColor: 'var(--brand)', color: 'var(--brand)' }}
            >
              {view === 'cliente' ? '🛡️ Acceso Oficina' : '👤 Acceso Cliente'}
            </button>
          </div>
        </header>

        {view === 'cliente' ? (
          <ClienteOTPLogin onSuccess={handleAuthenticated} firmaSlug={firmaSlug} onFirmaChange={setFirmaSlug} />
        ) : (
          <OficinaLogin onSuccess={handleAuthenticated} firmaSlug={firmaSlug} onFirmaChange={setFirmaSlug} />
        )}
      </div>
    );
  }

  if (
    usuarioAutenticado.rol === 'cliente'
    && location.pathname !== '/cliente'
  ) {
    return <Navigate to="/cliente" replace />;
  }

  if (usuarioAutenticado.rol !== 'cliente' && !validOfficeRoute) {
    return <Navigate to="/oficina/trabajo" replace />;
  }

  return (
    <div className="app-shell">
      {usuarioAutenticado.rol !== 'cliente' && (
        <AperturaAsuntoModal
          isOpen={aperturaAbierta}
          clientes={clientesAPI || []}
          responsables={
            usuarioAutenticado.rol === 'abogado'
              ? (responsablesAPI || []).filter(
                  (responsable) => responsable.id === usuarioAutenticado.id,
                )
              : (responsablesAPI || [])
          }
          usuarioActual={usuarioAutenticado}
          clienteInicialId={clienteInicialAperturaId || undefined}
          isLoading={mutacionApertura.isPending}
          errorMessage={
            mutacionApertura.isError
              ? 'No pudimos abrir el asunto. Revisa los datos e inténtalo de nuevo.'
              : undefined
          }
          onClose={() => {
            if (!mutacionApertura.isPending) {
              setAperturaAbierta(false);
              setClienteInicialAperturaId('');
              mutacionApertura.reset();
            }
          }}
          onSubmit={(payload) => mutacionApertura.mutate(payload)}
        />
      )}

      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Asuntia</h1>
            <span>
              {view === 'cliente'
                ? 'Portal del cliente'
                : seccionFirma === 'config_almacenamiento'
                  ? 'Ajustes'
                  : seccionFirma === 'trabajo'
                    ? 'Mi trabajo'
                    : 'Asuntos'}
            </span>
          </div>
        </div>

        <UserMenu
          user={usuarioAutenticado}
          onLogout={handleLogout}
          onOpenSettings={
            usuarioAutenticado.rol === 'administrador' && view === 'firma'
              ? () => navigate('/oficina/ajustes/almacenamiento')
              : undefined
          }
        />
      </header>

      {/* VISTA CLIENTE */}
      {view === 'cliente' && (
        <main className="main portal-shell">
          {portalQuery.isLoading ? (
            <div className="panel work-empty" role="status">
              <span className="muted">Consultando tus asuntos…</span>
            </div>
          ) : portalQuery.isError && !portalQuery.data ? (
            <div className="panel work-empty" role="alert">
              <div>
                <h3>No pudimos consultar tus asuntos</h3>
                <p className="muted small">Inténtalo de nuevo.</p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => portalQuery.refetch()}
                disabled={portalQuery.isFetching}
              >
                {portalQuery.isFetching ? 'Consultando…' : 'Reintentar'}
              </button>
            </div>
          ) : portalQuery.data ? (
            <>
              {portalQuery.isError && (
                <div className="work-stale-notice" role="status">
                  Mostrando la última información disponible.
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => portalQuery.refetch()}
                    disabled={portalQuery.isFetching}
                  >
                    Reintentar
                  </button>
                </div>
              )}
              <PortalCliente
                asuntos={portalQuery.data}
                clienteNombre={usuarioAutenticado.nombre}
                selectedId={casoIdSeleccionado}
                onSelect={setCasoIdSeleccionado}
              />
            </>
          ) : null}
        </main>
      )}
      {/* VISTA FIRMA */}
      {view === 'firma' && (
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-inner">
              <nav className="office-nav" aria-label="Navegación de oficina">
                <NavLink
                  className={({ isActive }) => isActive ? 'active' : ''}
                  to="/oficina/trabajo"
                >
                  <BriefcaseBusiness size={17} />
                  Mi trabajo
                </NavLink>
                <NavLink
                  className={seccionFirma === 'expedientes' ? 'active' : ''}
                  to="/oficina/asuntos"
                >
                  <UsersRound size={17} />
                  Clientes y asuntos
                </NavLink>
              </nav>

              {seccionFirma === 'config_almacenamiento' ? (
                <>
                  <div className="sidebar-divider" />
                  <div className="settings-sidebar-heading">
                    <span className="settings-icon"><HardDrive size={17} /></span>
                    <div>
                      <h3>Ajustes</h3>
                      <span className="muted small">Administración</span>
                    </div>
                  </div>
                  <nav className="settings-nav" aria-label="Ajustes de la firma">
                    <button type="button" className="active">
                      <HardDrive size={16} />
                      Almacenamiento
                    </button>
                  </nav>
                  <button
                    className="secondary-button settings-back"
                    type="button"
                    onClick={() => navigate('/oficina/trabajo')}
                  >
                    Volver a mi trabajo
                  </button>
                </>
              ) : seccionFirma === 'expedientes' ? (
                <>
                  <div className="sidebar-divider" />
                  <div className="section-title">
                    <h3>Directorio ({clientes.length})</h3>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => {
                        setClienteInicialAperturaId('');
                        setAperturaAbierta(true);
                      }}
                      aria-label="Abrir asunto"
                      title="Abrir asunto"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="stack">
                    {clientesQuery.isLoading ? (
                      <span className="muted small" role="status">Consultando clientes…</span>
                    ) : clientesQuery.isError && !clientesAPI ? (
                      <span className="muted small">Directorio no disponible.</span>
                    ) : clientes.length > 0 ? (
                      clientes.map(cli => (
                        <Link
                          key={cli.id}
                          className={`client-entry ${cli.id === (clienteActivo?.id || new URLSearchParams(location.search).get('cliente_id')) ? 'active' : ''}`}
                          to={`/oficina/asuntos?cliente_id=${cli.id}`}
                        >
                          <strong>{cli.nombre}</strong>
                          <span className="muted small">
                            {cli.asuntosRegistrados !== undefined && `${formatAsuntosCount(cli.asuntosRegistrados)} · `}
                            {cli.responsableNombre}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <div className="muted small" style={{ padding: '12px' }}>
                        Sin clientes registrados.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </aside>

          <section className="main">
            {seccionFirma === 'config_almacenamiento' ? (
              <div className="settings-content">
                <div className="toolbar settings-toolbar">
                  <div>
                    <h2>Ajustes de la firma</h2>
                    <span className="muted">Configuración disponible solo para administradores.</span>
                  </div>
                </div>
                <ConfiguracionAlmacenamiento />
              </div>
            ) : seccionFirma === 'trabajo' ? (
              <MiTrabajo
                isAdmin={usuarioAutenticado.rol === 'administrador'}
              />
            ) : asuntoIdRuta && detalleQuery.isLoading ? (
              <div className="panel work-empty" role="status">Consultando expediente…</div>
            ) : asuntoIdRuta && detalleQuery.isError && !detalle ? (
              <div className="panel work-empty" role="alert">
                <h3>No pudimos abrir el expediente</h3>
                <button className="secondary-button" onClick={() => detalleQuery.refetch()}>Reintentar</button>
                <NavLink to="/oficina/asuntos">Volver a expedientes</NavLink>
              </div>
            ) : !asuntoIdRuta ? (
              <ListaExpedientes clientes={clientesAPI || []} responsables={responsablesAPI || []} estados={estadosAPI || []}
                onAbrir={() => {
                  setClienteInicialAperturaId(new URLSearchParams(location.search).get('cliente_id') || '');
                  setAperturaAbierta(true);
                }} />
            ) : clienteActivo ? (
              <>
                <div className="toolbar">
                  <div>
                    <NavLink to={{ pathname: '/oficina/asuntos', search: location.search }}>Volver a expedientes</NavLink>
                    <h2>{clienteActivo.nombre}</h2>
                    <span className="muted">{clienteActivo.email} · CC/NIT: {clienteActivo.identificacion}</span>
                  </div>
                  <div className="toolbar-actions">
                    <ResponsableAsignacion
                      id={`cliente-${clienteActivo.id}-responsable`}
                      label="Responsable del cliente"
                      value={clienteActivo.responsableId}
                      responsables={responsablesAPI || []}
                      canEdit={puedeGestionarAsignaciones}
                      isPending={
                        mutacionResponsableCliente.isPending
                        && mutacionResponsableCliente.variables?.clienteId
                          === clienteActivo.id
                      }
                      errorMessage={
                        mutacionResponsableCliente.isError
                        && mutacionResponsableCliente.variables?.clienteId
                          === clienteActivo.id
                          ? 'No se pudo guardar la asignación.'
                          : undefined
                      }
                      onChange={(responsableId) => {
                        mutacionResponsableCliente.mutate({
                          clienteId: clienteActivo.id,
                          responsableId,
                        });
                      }}
                    />
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setClienteInicialAperturaId(clienteActivo.id);
                        setAperturaAbierta(true);
                      }}
                    >
                      <Plus size={16} />
                      Nuevo asunto
                    </button>
                  </div>
                </div>

                <div className="workspace-flow">
                  <ListaExpedientes key={clienteActivo.id} clienteId={clienteActivo.id} asuntoActivoId={casoActivo?.id} />

                  {casoActivo ? (
                    <section>
                      <section className="panel">
                        <div className="case-overview-header">
                          <div>
                            <h3>{casoActivo.nombre}</h3>
                            <span className="muted small">{casoActivo.codigo}</span>
                            {casoActivo.radicadoOficial && <p className="muted small">Radicado oficial · {casoActivo.radicadoOficial}</p>}
                          </div>
                          <div className="case-overview-actions">
                            <ResponsableAsignacion
                              id={`asunto-${casoActivo.id}-responsable`}
                              label="Abogado del asunto"
                              value={casoActivo.abogadoId}
                              responsables={responsablesAPI || []}
                              canEdit={puedeGestionarAsignaciones}
                              isPending={
                                mutacionResponsableAsunto.isPending
                                && mutacionResponsableAsunto.variables?.asuntoId
                                  === casoActivo.id
                              }
                              errorMessage={
                                mutacionResponsableAsunto.isError
                                && mutacionResponsableAsunto.variables?.asuntoId
                                  === casoActivo.id
                                  ? 'No se pudo transferir el asunto.'
                                  : undefined
                              }
                              onChange={(responsableId) => {
                                mutacionResponsableAsunto.mutate({
                                  asuntoId: casoActivo.id,
                                  responsableId,
                                });
                              }}
                            />
                            <span className="row case-public-status">
                              <span className="muted small">Estado del expediente</span>
                              <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                              <Tooltip
                                content={casoActivo.estadoDescripcion
                                  || 'Estado registrado por la firma para este expediente.'}
                              />
                            </span>
                          </div>
                        </div>

                        {puedeDecidirCaso && (
                          <div className="expediente-status-editor">
                            <form onSubmit={handleGuardarEstado}>
                              <div className="form-grid">
                                <div className="field">
                                  <div className="row"><label htmlFor="estado-procesal-select">Actualizar estado</label><Tooltip content="Registra el estado del expediente sin completar los pasos de trabajo." /></div>
                                  <select
                                    id="estado-procesal-select"
                                    value={estadoSeleccionadoId}
                                    onChange={(e) => setEstadoSeleccionadoId(e.target.value)}
                                  >
                                    <option value="">Sin estado registrado</option>
                                    {estadosAPI && estadosAPI.length > 0 && (
                                      estadosAPI.map((est: EstadoProcesalAPI) => (
                                        <option key={est.id} value={est.id}>
                                          {est.nombre}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                </div>

                                <div className="field">
                                  <label>&nbsp;</label>
                                  <button className="secondary-button" type="submit" disabled={mutacionEstado.isPending}>
                                    <Save size={16} />
                                    {mutacionEstado.isPending ? 'Guardando…' : 'Guardar estado'}
                                  </button>
                                </div>
                              </div>
                            </form>
                            {mutacionEstado.isError && mutacionEstado.variables?.asuntoId === casoActivo.id && <p className="form-error" role="alert">No se pudo actualizar el estado. Inténtalo de nuevo.</p>}
                            {mutacionEstado.isSuccess && mutacionEstado.variables?.asuntoId === casoActivo.id && <p className="muted small" role="status">Estado actualizado</p>}
                          </div>
                        )}
                      </section>

                      {casoActivo.rutaCodigo && casoActivo.flujoEstado ? <FlujoAsunto
                        key={`flujo-${casoActivo.id}`}
                        pasos={casoActivo.pasos}
                        flujoEstado={casoActivo.flujoEstado}
                        radicadoOficial={casoActivo.radicadoOficial}
                        canAdvance={puedeDecidirCaso}
                        canSave={puedeDecidirCaso || usuarioAutenticado.rol === 'auxiliar'}
                        readOnlyReason={
                          'Este paso está asignado a otro abogado.'
                        }
                        onAdvance={(pasoCodigo, datos, expectedUpdatedAt) => mutacionAvanzarPaso.mutateAsync({
                          asuntoId: casoActivo.id,
                          pasoCodigo,
                          datos,
                          expectedUpdatedAt,
                        })}
                        onSave={(pasoCodigo, datos, expectedUpdatedAt) => mutacionBorrador.mutateAsync({
                          asuntoId: casoActivo.id, pasoCodigo, datos, expectedUpdatedAt,
                        })}
                        onReload={async () => {
                          return queryClient.fetchQuery({
                            queryKey: ['asuntos', 'detalle', casoActivo.id],
                            queryFn: () => fetchAsunto(casoActivo.id),
                            staleTime: 0,
                          });
                        }}
                      /> : <section className="panel">
                        <div className="section-title"><h3>Guía de trabajo</h3></div>
                        <span className="muted small">Sin guía</span>
                        {puedeDecidirCaso && <button className="secondary-button" type="button"
                          disabled={mutacionGuia.isPending}
                          onClick={() => mutacionGuia.mutate(casoActivo.id)}>
                          {mutacionGuia.isPending ? 'Incorporando…' : 'Incorporar guía de insolvencia'}
                        </button>}
                        {mutacionGuia.isError && mutacionGuia.variables === casoActivo.id &&
                          <p className="form-error" role="alert">No se pudo incorporar la guía. Revisa el expediente antes de reintentar.</p>}
                      </section>}

                      {/* Gestión documental del expediente */}
                      <TareasAsunto
                        key={`tareas-${casoActivo.id}`}
                        asuntoId={casoActivo.id}
                        abogadoId={casoActivo.abogadoId}
                        userId={usuarioAutenticado.id}
                        canManage={puedeDecidirCaso}
                      />
                      <DocumentosTab
                        key={`documentos-${casoActivo.id}`}
                        asuntoId={casoActivo.id}
                        isReadOnly={false}
                        canManagePublication={puedeDecidirCaso}
                      />

                      <ActividadExpediente
                        key={`actividad-${casoActivo.id}`}
                        asuntoId={casoActivo.id}
                        novedades={casoActivo.novedades}
                        canPublish={puedeDecidirCaso}
                      />
                    </section>
                  ) : (
                    <div className="panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <h3>Sin asuntos para este cliente</h3>
                      <button
                        className="primary-button"
                        style={{ margin: '16px auto 0' }}
                        onClick={() => {
                          setClienteInicialAperturaId(clienteActivo.id);
                          setAperturaAbierta(true);
                        }}
                      >
                        <Plus size={16} /> Crear expediente
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="muted" role="status">Consultando expediente…</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
