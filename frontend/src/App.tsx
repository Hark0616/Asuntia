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
  CircleCheck, 
  ChevronRight, 
  ChevronDown, 
  CalendarClock, 
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
  fetchEstadosAPI, 
  fetchClientesAPI,
  fetchResponsablesAPI,
  abrirAsuntoAPI,
  avanzarPasoAPI,
  crearNovedadAPI, 
  actualizarEstadoAPI, 
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
import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';
import { UserMenu } from '@/components/layout/UserMenu';
import { MiTrabajo } from '@/features/tareas/components/MiTrabajo';
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

interface Milestone {
  id: number;
  fecha: string;
  titulo: string;
  estadoBadge: string;
  tipoBadge?: 'neutral' | 'warning';
  estadoItem: 'completed' | 'current' | 'upcoming';
  detalle?: string;
  subtexto?: string;
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
  proximoPaso: string;
  solicitudPendiente?: string;
  fechaLimiteSolicitud?: string;
  milestones: Milestone[];
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
  const [milestoneAbiertoId, setMilestoneAbiertoId] = useState<number | null>(2);
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
  const { data: asuntosAPI } = useQuery({
    queryKey: ['asuntos'],
    queryFn: fetchAsuntos,
    retry: 1,
    enabled: authenticated,
  });
  const { data: estadosAPI } = useQuery({
    queryKey: ['estados'],
    queryFn: fetchEstadosAPI,
    retry: 1,
    enabled: authenticated,
  });
  const { data: clientesAPI } = useQuery({
    queryKey: ['clientes'],
    queryFn: fetchClientesAPI,
    retry: 1,
    enabled: officeUser,
  });
  const { data: responsablesAPI } = useQuery({
    queryKey: ['equipo', 'responsables'],
    queryFn: fetchResponsablesAPI,
    retry: 1,
    enabled: officeUser,
  });

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
    },
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { estado_id?: string } }) =>
      actualizarEstadoAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  // El cliente autenticado se convierte en la única raíz disponible en su portal.
  const clientesFuente: ClienteAPI[] = usuarioAutenticado?.rol === 'cliente'
    ? [{
        id: usuarioAutenticado.id,
        tipo_persona: 'natural',
        tipo_documento: 'CC',
        numero_documento: usuarioAutenticado.cedula,
        nombre: usuarioAutenticado.nombre,
        cedula: usuarioAutenticado.cedula,
        email: usuarioAutenticado.email,
        canal_preferido: 'email',
        portal_habilitado: true,
        asuntos_count: (asuntosAPI || []).length,
        rol: usuarioAutenticado.rol,
        created_at: '',
      }]
    : (clientesAPI || []);

  const clientes: ClienteData[] = clientesFuente.map((cli: ClienteAPI) => {
      const casosDelCliente = (asuntosAPI || []).filter((as: AsuntoAPI) => as.cliente_id === cli.id);

      return {
        id: cli.id,
        nombre: cli.nombre,
        contacto: cli.nombre.split(' ')[0],
        email: cli.email,
        identificacion: cli.cedula,
        asuntosRegistrados: cli.asuntos_count,
        casos: casosDelCliente.map((as: AsuntoAPI) => ({
          id: as.id,
          codigo: as.radicado,
          nombre: 'Insolvencia Persona Natural',
          responsable: 'Equipo jurídico asignado',
          estadoBadge: as.estado?.nombre || 'En trámite',
          estadoTipo: (as.estado?.color_tipo as any) || 'mint',
          estadoId: as.estado?.id,
          estadoDescripcion: as.estado?.descripcion,
          accionActual: as.pasos.find((paso) => paso.estado === 'activo')?.titulo
            || as.etapa_actual,
          abogadoId: as.abogado_id,
          prioridad: 'normal' as const,
          proximoPaso: as.siguiente_paso,
          milestones: as.pasos.map((paso) => ({
            id: paso.orden,
            fecha: paso.completed_at
              ? new Date(paso.completed_at).toLocaleDateString()
              : paso.estado === 'activo' ? 'En curso' : 'Pendiente',
            titulo: `Paso ${paso.orden}: ${paso.titulo}`,
            estadoBadge: paso.estado === 'completado' ? 'Completado' : paso.estado === 'activo' ? 'Actual' : 'Pendiente',
            estadoItem: paso.estado === 'completado' ? 'completed' : paso.estado === 'activo' ? 'current' : 'upcoming',
            detalle: paso.descripcion,
          })),
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
        }))
      };
    });

  // Selección activa
  const clienteActivo = usuarioAutenticado?.rol === 'cliente'
    ? clientes[0] || null
    : clientes.find(c => c.id === clienteIdSeleccionado) || null;
  const casoActivo = clienteActivo && clienteActivo.casos ? (clienteActivo.casos.find(c => c.id === casoIdSeleccionado) || clienteActivo.casos[0] || null) : null;

  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');
  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('client');

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
          publicado_al_cliente: nuevoAvanceVisibilidad === 'client'
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
                ? (casoActivo?.codigo || 'Cliente')
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
        <section className="main tracking-shell">
          {casoActivo ? (
            <>
              <div className="tracking-header">
                <div className="row between wrap" style={{ width: '100%' }}>
                  <div>
                    <span className="badge neutral">{casoActivo.codigo}</span>
                    <h2>{casoActivo.nombre}</h2>
                    <p className="muted">{clienteActivo?.nombre} · {casoActivo.responsable}</p>
                  </div>

                  {clienteActivo && clienteActivo.casos.length > 1 && (
                    <div className="field" style={{ minWidth: '220px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 600 }}>Seleccionar Expediente:</label>
                      <select 
                        value={casoActivo.id} 
                        onChange={(e) => setCasoIdSeleccionado(e.target.value)}
                        style={{ height: '38px', fontSize: '14px' }}
                      >
                        {clienteActivo.casos.map(cs => (
                          <option key={cs.id} value={cs.id}>{cs.codigo} ({cs.estadoBadge})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {casoActivo.solicitudPendiente && (
                <section className="client-action-card">
                  <div>
                    <div className="row">
                      <span className="badge warning">Documento requerido</span>
                      <Tooltip content="Envía este documento a tu abogada para continuar la radicación." />
                    </div>
                    <h3 style={{ marginTop: '6px' }}>{casoActivo.solicitudPendiente}</h3>
                    <span className="muted small">Límite: {casoActivo.fechaLimiteSolicitud || 'Próximamente'}</span>
                  </div>
                </section>
              )}

              <section className="tracking-grid">
                <div className="panel tracking-main">
                  <div>
                    <div className="row between">
                      <h3>
                        Estado actual
                        <Tooltip content="El estado procesal oficial notificado por el juzgado o Centro de Conciliación." />
                      </h3>
                      <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                    </div>
                  </div>

                  <div className="milestone-list">
                    {casoActivo.milestones.map((m) => (
                      <article key={m.id} className={`milestone-item milestone-${m.estadoItem}`}>
                        <div className="milestone-rail">
                          <div className="milestone-marker">
                            {m.estadoItem === 'completed' ? <CircleCheck size={16} /> : m.id}
                          </div>
                          {m.id < casoActivo.milestones.length && <div className="milestone-line"></div>}
                        </div>

                        <div className="milestone-card">
                          <button 
                            className="milestone-head" 
                            type="button"
                            onClick={() => setMilestoneAbiertoId(milestoneAbiertoId === m.id ? null : m.id)}
                          >
                            <div>
                              <span className="muted small">{m.fecha}</span>
                              <strong>{m.titulo}</strong>
                            </div>
                            <div className="row">
                              <span className={`badge ${m.tipoBadge || 'neutral'}`}>{m.estadoBadge}</span>
                              {milestoneAbiertoId === m.id ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                            </div>
                          </button>

                          {milestoneAbiertoId === m.id && m.detalle && (
                            <div className="milestone-detail">
                              <p>{m.detalle}</p>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>

                  {/* Documentos Compartidos en Portal Cliente */}
                  <DocumentosTab asuntoId={casoActivo.id} isReadOnly={true} />
                </div>

                <aside className="tracking-side">
                  <div className="panel">
                    <div className="section-title">
                      <h3>Próximo paso</h3>
                      <CalendarClock size={17} />
                    </div>
                    <div className="list-card">
                      <strong>{casoActivo.proximoPaso}</strong>
                    </div>
                  </div>

                  <div className="panel">
                    <div className="section-title">
                      <h3>Avances publicados</h3>
                      <History size={17} />
                    </div>
                    <div className="timeline">
                      {casoActivo.novedades.filter(n => n.visibilidad === 'Cliente').map(n => (
                        <div key={n.id} className="timeline-item">
                          <div className="timeline-dot">
                            <Clock3 size={14} />
                          </div>
                          <div className="timeline-body">
                            <div className="row between">
                              <strong>{n.autor}</strong>
                              <span className="muted small">{n.fecha}</span>
                            </div>
                            <p style={{ fontSize: '13px', marginTop: '4px' }}>{n.texto}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </section>
            </>
          ) : (
            <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <h3>Sin expedientes activos</h3>
              <p className="muted small">Tu abogada aún no ha aperturado un expediente para tu documento.</p>
            </div>
          )}
        </section>
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
                    {clientes.length > 0 ? (
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
            ) : clienteActivo ? (
              <>
                <div className="toolbar">
                  <div>
                    <h2>{clienteActivo.nombre}</h2>
                    <span className="muted">{clienteActivo.email} · CC/NIT: {clienteActivo.identificacion}</span>
                  </div>
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
                                <span className="muted small">{cs.codigo}</span>
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
                        <div className="row between">
                          <div>
                            <h3>{casoActivo.nombre}</h3>
                            <span className="muted small">{casoActivo.codigo} · {casoActivo.responsable}</span>
                          </div>
                          <span className="row case-public-status">
                            <span className="muted small">Estado comunicado</span>
                            <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                            <Tooltip
                              content={casoActivo.estadoDescripcion
                                || 'Estado procesal que se muestra al cliente.'}
                            />
                          </span>
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
                      <DocumentosTab asuntoId={casoActivo.id} isReadOnly={false} />

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
                              value={nuevoAvanceTexto}
                              onChange={(e) => setNuevoAvanceTexto(e.target.value)}
                              placeholder="Nota sobre el expediente..."
                            />
                          </div>

                          <div className="field">
                            <label htmlFor="update-visibility">Visibilidad</label>
                            <select 
                              id="update-visibility"
                              value={nuevoAvanceVisibilidad}
                              onChange={(e) => setNuevoAvanceVisibilidad(e.target.value as 'client' | 'internal')}
                            >
                              <option value="client">Cliente (Público)</option>
                              <option value="internal">Interno (Solo firma)</option>
                            </select>
                          </div>

                          <div className="field">
                            <label>&nbsp;</label>
                            <button className="primary-button" type="submit">
                              <Send size={16} />
                              Registrar nota
                            </button>
                          </div>
                        </div>
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
