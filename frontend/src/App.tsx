import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Navigate,
  NavLink,
  matchPath,
  useLocation,
  useNavigate,
} from 'react-router';
import { 
  BriefcaseBusiness,
  History, 
  Plus, 
  Save, 
  Eye, 
  Send, 
  Clock3,
  HardDrive,
  UsersRound,
} from 'lucide-react';
import { 
  fetchAsuntos, 
  fetchAsuntosPortalAPI,
  fetchEstadosAPI, 
  fetchClientesAPI,
  fetchResponsablesAPI,
  abrirAsuntoAPI,
  avanzarPasoAPI,
  crearNovedadAPI, 
  actualizarEstadoAPI, 
  asignarResponsableClienteAPI,
  asignarResponsableAsuntoAPI,
  AsuntoAPI, 
  EstadoProcesalAPI,
  ClienteAPI,
  AperturaAsuntoPayload,
} from '@/features/asuntos/api/asuntos';
import { ClienteOTPLogin } from '@/features/auth/components/ClienteOTPLogin';
import { OficinaLogin } from '@/features/auth/components/OficinaLogin';
import { fetchCurrentUserAPI, logoutAPI } from '@/features/auth/api/auth';
import type { User } from '@/types/api';
import { Tooltip } from '@/components/ui/Tooltip';
import { AperturaAsuntoModal } from '@/components/ui/AperturaAsuntoModal';
import { DocumentosTab } from '@/features/documentos/components/DocumentosTab';
import { ConfiguracionAlmacenamiento } from '@/features/firma/components/ConfiguracionAlmacenamiento';
import { FlujoAsunto } from '@/features/asuntos/components/FlujoAsunto';
import { ResponsableAsignacion } from '@/features/asuntos/components/ResponsableAsignacion';
import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';
import { UserMenu } from '@/components/layout/UserMenu';
import { MiTrabajo } from '@/features/tareas/components/MiTrabajo';
import { PortalCliente } from '@/features/portal-cliente/components/PortalCliente';
import { formatAsuntosCount } from '@/lib/formatAsuntos';

interface NovedadItem {
  id: string;
  autor: string;
  titulo: string;
  tipo: 'nota' | 'paso_completado' | 'documento_incorporado';
  fecha: string;
  texto: string;
  visibilidad: 'Cliente' | 'Interno';
}

interface CasoData {
  id: string;
  codigo: string;
  nombre: string;
  responsable: string;
  estadoBadge: string;
  estadoTipo: 'warning' | 'neutral' | 'mint' | 'danger';
  estadoId?: string;
  estadoDescripcion?: string;
  accionActual: string;
  abogadoId?: string;
  prioridad: 'alta' | 'normal';
  novedades: NovedadItem[];
  pasos: AsuntoPasoAPI[];
  flujoEstado: 'activo' | 'completado';
}

interface ClienteData {
  id: string;
  nombre: string;
  contacto: string;
  email: string;
  identificacion: string;
  responsableId?: string;
  responsableNombre: string;
  asuntosRegistrados: number;
  casos: CasoData[];
}

export default function App() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<User | null | undefined>(undefined);
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('');
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
  const asuntosQuery = useQuery({
    queryKey: ['asuntos'],
    queryFn: fetchAsuntos,
    retry: 1,
    enabled: officeUser,
  });
  const { data: asuntosAPI } = asuntosQuery;
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
  const puedeGestionarAsignaciones = (
    usuarioAutenticado?.rol === 'administrador'
    || usuarioAutenticado?.rol === 'auxiliar'
  );

  // Mutaciones
  const mutacionApertura = useMutation({
    mutationFn: (payload: AperturaAsuntoPayload) => abrirAsuntoAPI(payload),
    onSuccess: (newAsunto) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
      setClienteIdSeleccionado(newAsunto.cliente_id);
      setCasoIdSeleccionado(newAsunto.id);
      setAperturaAbierta(false);
      setClienteInicialAperturaId('');
      navigate(`/oficina/asuntos/${newAsunto.id}#paso-activo`);
    }
  });

  const mutacionAvanzarPaso = useMutation({
    mutationFn: ({ asuntoId, pasoCodigo, datos }: { asuntoId: string; pasoCodigo: string; datos: Record<string, unknown> }) =>
      avanzarPasoAPI(asuntoId, { paso_codigo: pasoCodigo, datos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      queryClient.invalidateQueries({ queryKey: ['tareas'] });
    },
  });

  const mutacionNovedad = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean } }) =>
      crearNovedadAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      setNuevoAvanceTexto('');
      setNuevoAvanceVisibilidad('internal');
    },
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { estado_id?: string } }) =>
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

  const clientes: ClienteData[] = (clientesAPI || []).map((cli: ClienteAPI) => {
      const casosDelCliente = (asuntosAPI || []).filter((as: AsuntoAPI) => as.cliente_id === cli.id);
      const responsableCliente = (responsablesAPI || []).find(
        (responsable) => responsable.id === cli.responsable_id,
      );

      return {
        id: cli.id,
        nombre: cli.nombre,
        contacto: cli.nombre.split(' ')[0],
        email: cli.email,
        identificacion: cli.cedula,
        responsableId: cli.responsable_id,
        responsableNombre: responsableCliente?.nombre || 'Sin asignar',
        asuntosRegistrados: cli.asuntos_count,
        casos: casosDelCliente.map((as: AsuntoAPI) => {
          const responsableAsunto = (responsablesAPI || []).find(
            (responsable) => responsable.id === as.abogado_id,
          );
          return {
          id: as.id,
          codigo: as.radicado,
          nombre: 'Insolvencia Persona Natural',
          responsable: responsableAsunto?.nombre || 'Sin asignar',
          estadoBadge: as.estado?.nombre || 'En trámite',
          estadoTipo: (as.estado?.color_tipo as any) || 'mint',
          estadoId: as.estado?.id,
          estadoDescripcion: as.estado?.descripcion,
          accionActual: as.pasos.find((paso) => paso.estado === 'activo')?.titulo
            || as.etapa_actual,
          abogadoId: as.abogado_id,
          prioridad: 'normal' as const,
          pasos: as.pasos,
          flujoEstado: as.flujo_estado,
          novedades: as.novedades.map(nov => ({
            id: nov.id,
            autor: nov.tipo === 'nota' ? 'Nota de la firma' : 'Actividad del sistema',
            titulo: nov.titulo,
            tipo: nov.tipo,
            fecha: new Intl.DateTimeFormat('es-CO', {
              timeZone: 'America/Bogota',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(nov.created_at)),
            texto: nov.descripcion,
            visibilidad: nov.publicado_al_cliente ? 'Cliente' : 'Interno'
          }))
          };
        })
      };
    });

  // Selección activa
  const clienteActivo = clientes.find(c => c.id === clienteIdSeleccionado) || null;
  const casoActivo = clienteActivo && clienteActivo.casos ? (clienteActivo.casos.find(c => c.id === casoIdSeleccionado) || clienteActivo.casos[0] || null) : null;

  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');
  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('internal');

  React.useEffect(() => {
    setEstadoSeleccionadoId(casoActivo?.estadoId || '');
  }, [casoActivo?.id, casoActivo?.estadoId]);

  React.useEffect(() => {
    const asuntoId = asuntoRouteMatch?.params.asuntoId;
    if (!asuntoId || !asuntosAPI) return;
    const asunto = asuntosAPI.find((item) => item.id === asuntoId);
    if (asunto) {
      setClienteIdSeleccionado(asunto.cliente_id);
      setCasoIdSeleccionado(asunto.id);
    }
  }, [asuntoRouteMatch?.params.asuntoId, asuntosAPI]);

  React.useEffect(() => {
    if (!casoActivo || location.hash !== '#paso-activo') return;
    const frame = window.requestAnimationFrame(() => {
      const activeStep = document.getElementById('paso-activo');
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
          estado_id: estadoSeleccionadoId || casoActivo.estadoId
        }
      });
    }
  };

  const handlePublicarAvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoAvanceTexto.trim()) return;

    if (casoActivo) {
      mutacionNovedad.mutate({
        asuntoId: casoActivo.id,
        payload: {
          titulo: 'Avance procesal',
          descripcion: nuevoAvanceTexto,
          publicado_al_cliente: usuarioAutenticado?.rol !== 'auxiliar'
            && nuevoAvanceVisibilidad === 'client'
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
          <ClienteOTPLogin onSuccess={handleAuthenticated} />
        ) : (
          <OficinaLogin onSuccess={handleAuthenticated} />
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
                        <NavLink
                          key={cli.id}
                          className={`client-entry ${clienteActivo && cli.id === clienteActivo.id ? 'active' : ''}`}
                          to={cli.casos?.[0]
                            ? `/oficina/asuntos/${cli.casos[0].id}`
                            : '/oficina/asuntos'}
                          onClick={() => {
                            setClienteIdSeleccionado(cli.id);
                            if (cli.casos && cli.casos.length > 0) {
                              setCasoIdSeleccionado(cli.casos[0].id);
                            }
                          }}
                        >
                          <strong>{cli.nombre}</strong>
                          <span className="muted small">
                            {formatAsuntosCount(cli.asuntosRegistrados)}
                            {' · '}
                            {cli.responsableNombre}
                          </span>
                        </NavLink>
                      ))
                    ) : (
                      <div className="muted small" style={{ padding: '12px' }}>
                        Sin clientes registrados.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="office-nav-note">
                  <span className="muted small">Tu bandeja reúne los pasos abiertos de los asuntos asignados.</span>
                </div>
              )}
            </div>
          </aside>

          <section className="main">
            {seccionFirma === 'expedientes'
              && (asuntosQuery.isError || clientesQuery.isError)
              && asuntosAPI && clientesAPI && (
                <div className="work-stale-notice" role="status">
                  Mostrando la última información disponible.
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      asuntosQuery.refetch();
                      clientesQuery.refetch();
                    }}
                    disabled={asuntosQuery.isFetching || clientesQuery.isFetching}
                  >
                    Reintentar
                  </button>
                </div>
              )}
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
            ) : asuntosQuery.isLoading || clientesQuery.isLoading ? (
              <div className="panel work-empty" role="status">
                <span className="muted">Consultando expedientes…</span>
              </div>
            ) : (asuntosQuery.isError && !asuntosAPI)
              || (clientesQuery.isError && !clientesAPI) ? (
              <div className="panel work-empty" role="alert">
                <div>
                  <h3>No pudimos consultar los expedientes</h3>
                  <p className="muted small">Inténtalo de nuevo.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    asuntosQuery.refetch();
                    clientesQuery.refetch();
                  }}
                  disabled={asuntosQuery.isFetching || clientesQuery.isFetching}
                >
                  Reintentar
                </button>
              </div>
            ) : clienteActivo ? (
              <>
                <div className="toolbar">
                  <div>
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
                  <section className="panel case-nav-panel">
                    <div className="section-title">
                      <h3>
                        {usuarioAutenticado.rol === 'abogado'
                          ? 'Asuntos a tu cargo'
                          : 'Asuntos'} ({clienteActivo.casos ? clienteActivo.casos.length : 0})
                      </h3>
                    </div>
                    <div className="case-list">
                      {clienteActivo.casos && clienteActivo.casos.length > 0 ? (
                        clienteActivo.casos.map(cs => (
                          <NavLink
                            key={cs.id}
                            className={`case-card ${casoActivo && cs.id === casoActivo.id ? 'active' : ''}`}
                            to={`/oficina/asuntos/${cs.id}`}
                            onClick={() => setCasoIdSeleccionado(cs.id)}
                          >
                            <div className="case-card-header">
                              <div>
                                <strong>{cs.nombre}</strong>
                                <span className="muted small">
                                  {cs.codigo} · {cs.responsable}
                                </span>
                              </div>
                            </div>
                            <span className="case-card-current">
                              Acción actual · {cs.accionActual}
                            </span>
                          </NavLink>
                        ))
                      ) : (
                        <div className="muted small" style={{ padding: '16px' }}>
                          Sin asuntos. Usa “Nuevo asunto” para abrir el primero.
                        </div>
                      )}
                    </div>
                  </section>

                  {casoActivo ? (
                    <section>
                      <section className="panel">
                        <div className="case-overview-header">
                          <div>
                            <h3>{casoActivo.nombre}</h3>
                            <span className="muted small">{casoActivo.codigo}</span>
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
                              <span className="muted small">Estado comunicado</span>
                              <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                              <Tooltip
                                content={casoActivo.estadoDescripcion
                                  || 'Estado procesal que se muestra al cliente.'}
                              />
                            </span>
                          </div>
                        </div>

                        {usuarioAutenticado.rol === 'administrador' && (
                          <details className="administrative-correction">
                            <summary>
                              Corrección administrativa
                              <Tooltip content="Ajusta el estado público sin modificar la ruta del expediente." />
                            </summary>
                            <form onSubmit={handleGuardarEstado}>
                              <div className="form-grid">
                                <div className="field">
                                  <label htmlFor="estado-procesal-select">Estado público</label>
                                  <select
                                    id="estado-procesal-select"
                                    value={estadoSeleccionadoId || casoActivo.estadoId || ''}
                                    onChange={(e) => setEstadoSeleccionadoId(e.target.value)}
                                  >
                                    {estadosAPI && estadosAPI.length > 0 ? (
                                      estadosAPI.map((est: EstadoProcesalAPI) => (
                                        <option key={est.id} value={est.id}>
                                          {est.nombre}
                                        </option>
                                      ))
                                    ) : (
                                      <option value="">{casoActivo.estadoBadge}</option>
                                    )}
                                  </select>
                                </div>

                                <div className="field">
                                  <label>&nbsp;</label>
                                  <button className="secondary-button" type="submit">
                                    <Save size={16} />
                                    Guardar corrección
                                  </button>
                                </div>
                              </div>
                            </form>
                          </details>
                        )}
                      </section>

                      <FlujoAsunto
                        pasos={casoActivo.pasos}
                        flujoEstado={casoActivo.flujoEstado}
                        isLoading={mutacionAvanzarPaso.isPending}
                        canAdvance={
                          usuarioAutenticado.rol === 'administrador'
                          || (
                            usuarioAutenticado.rol === 'abogado'
                            && casoActivo.abogadoId === usuarioAutenticado.id
                          )
                        }
                        readOnlyReason={
                          usuarioAutenticado.rol === 'auxiliar'
                            ? 'Tu perfil puede consultar esta ruta.'
                            : 'Este paso está asignado a otro abogado.'
                        }
                        onAdvance={(pasoCodigo, datos) => mutacionAvanzarPaso.mutateAsync({
                          asuntoId: casoActivo.id,
                          pasoCodigo,
                          datos,
                        })}
                      />

                      {/* Gestión documental del expediente */}
                      <DocumentosTab
                        key={casoActivo.id}
                        asuntoId={casoActivo.id}
                        isReadOnly={false}
                        canManagePublication={usuarioAutenticado.rol === 'administrador'
                          || usuarioAutenticado.rol === 'abogado'}
                      />

                      <form className="panel" onSubmit={handlePublicarAvance} style={{ marginTop: '16px' }}>
                        <div className="section-title">
                          <h3>Registrar nota</h3>
                          <Eye size={17} />
                        </div>
                        <div className="form-grid">
                          <div className="field full">
                            <label htmlFor="update-body">Contenido</label>
                            <textarea 
                              id="update-body" 
                              required
                              disabled={mutacionNovedad.isPending}
                              value={nuevoAvanceTexto}
                              onChange={(e) => setNuevoAvanceTexto(e.target.value)}
                              placeholder="Nota sobre el expediente..."
                            />
                          </div>

                          {usuarioAutenticado.rol !== 'auxiliar' && (
                            <div className="field">
                              <label htmlFor="update-visibility">Visibilidad</label>
                              <select
                                id="update-visibility"
                                value={nuevoAvanceVisibilidad}
                                disabled={mutacionNovedad.isPending}
                                onChange={(e) => setNuevoAvanceVisibilidad(e.target.value as 'client' | 'internal')}
                              >
                                <option value="internal">Interno (Solo firma)</option>
                                <option value="client">Compartir con el cliente</option>
                              </select>
                            </div>
                          )}

                          <div className="field">
                            <label>&nbsp;</label>
                            <button
                              className="primary-button"
                              type="submit"
                              disabled={mutacionNovedad.isPending}
                            >
                              <Send size={16} />
                              {mutacionNovedad.isPending ? 'Guardando…' : 'Registrar nota'}
                            </button>
                          </div>
                        </div>
                        {mutacionNovedad.isError && (
                          <p className="form-error" role="alert">
                            No pudimos guardar la nota. Inténtalo de nuevo.
                          </p>
                        )}
                      </form>

                      <div className="panel">
                        <div className="section-title">
                          <h3>Actividad del expediente</h3>
                          <History size={17} />
                        </div>

                        <div className="timeline">
                          {casoActivo.novedades && casoActivo.novedades.length > 0 ? (
                            casoActivo.novedades.map((n) => (
                              <div key={n.id} className="timeline-item">
                                <div className="timeline-dot">
                                  <Clock3 size={14} />
                                </div>
                                <div className="timeline-body">
                                  <div className="row between">
                                    <strong>{n.titulo}</strong>
                                    <span className="muted small">{n.fecha}</span>
                                  </div>
                                  <span className="muted small">{n.autor}</span>
                                  <p style={{ margin: '4px 0' }}>{n.texto}</p>
                                  <span className={`badge ${n.visibilidad === 'Cliente' ? 'neutral' : 'warning'}`}>
                                    {n.visibilidad}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="muted small" style={{ padding: '12px' }}>
                              Sin actividad registrada.
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <h3>Sin asuntos para este cliente</h3>
                      <p className="muted small">Abre el primer asunto para iniciar su ruta de trabajo.</p>
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
              <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
                {clientes.length > 0 ? (
                  <>
                    <h3>Selecciona un cliente</h3>
                    <p className="muted small">
                      Elige un cliente en la barra lateral para consultar sus asuntos.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>No hay clientes registrados</h3>
                    <button
                      className="primary-button"
                      style={{ margin: '16px auto 0' }}
                      onClick={() => {
                        setClienteInicialAperturaId('');
                        setAperturaAbierta(true);
                      }}
                    >
                      <Plus size={16} /> Registrar primer cliente
                    </button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
