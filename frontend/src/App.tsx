import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
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
  HardDrive
} from 'lucide-react';
import { 
  fetchAsuntos, 
  fetchEstadosAPI, 
  fetchClientesAPI,
  crearClienteAPI,
  crearAsuntoAPI,
  avanzarPasoAPI,
  crearNovedadAPI, 
  actualizarEstadoAPI, 
  AsuntoAPI, 
  EstadoProcesalAPI,
  ClienteAPI
} from '@/features/asuntos/api/asuntos';
import { ClienteOTPLogin } from '@/features/auth/components/ClienteOTPLogin';
import { OficinaLogin } from '@/features/auth/components/OficinaLogin';
import { fetchCurrentUserAPI, logoutAPI } from '@/features/auth/api/auth';
import type { User } from '@/types/api';
import { Tooltip } from '@/components/ui/Tooltip';
import { CrearClienteModal } from '@/components/ui/CrearClienteModal';
import { CrearAsuntoModal } from '@/components/ui/CrearAsuntoModal';
import { DocumentosTab } from '@/features/documentos/components/DocumentosTab';
import { ConfiguracionAlmacenamiento } from '@/features/firma/components/ConfiguracionAlmacenamiento';
import { FlujoAsunto } from '@/features/asuntos/components/FlujoAsunto';
import type { AsuntoPasoAPI } from '@/features/asuntos/api/asuntos';
import { UserMenu } from '@/components/layout/UserMenu';

interface NovedadItem {
  id: string;
  autor: string;
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
  casos: CasoData[];
}

export default function App() {
  const queryClient = useQueryClient();
  
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<User | null | undefined>(undefined);
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [seccionFirma, setSeccionFirma] = useState<'expedientes' | 'config_almacenamiento'>('expedientes');
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('');
  const [casoIdSeleccionado, setCasoIdSeleccionado] = useState<string>('');
  const [milestoneAbiertoId, setMilestoneAbiertoId] = useState<number | null>(2);
  const [crearClienteAbierto, setCrearClienteAbierto] = useState(false);
  const [crearAsuntoAbierto, setCrearAsuntoAbierto] = useState(false);

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
  const { data: asuntosAPI, isSuccess: apiConectada } = useQuery({
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

  // Mutaciones
  const mutacionNuevoCliente = useMutation({
    mutationFn: (payload: { nombre: string; cedula: string; email: string; telefono?: string }) => crearClienteAPI(payload),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setClienteIdSeleccionado(newClient.id);
      setCrearClienteAbierto(false);
    }
  });

  const mutacionNuevoAsunto = useMutation({
    mutationFn: (payload: { cliente_id: string }) => crearAsuntoAPI(payload),
    onSuccess: (newAsunto) => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      setCasoIdSeleccionado(newAsunto.id);
      setCrearAsuntoAbierto(false);
    }
  });

  const mutacionAvanzarPaso = useMutation({
    mutationFn: ({ asuntoId, pasoCodigo, datos }: { asuntoId: string; pasoCodigo: string; datos: Record<string, unknown> }) =>
      avanzarPasoAPI(asuntoId, { paso_codigo: pasoCodigo, datos }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  const mutacionNovedad = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean } }) =>
      crearNovedadAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { estado_id?: string; siguiente_paso?: string } }) =>
      actualizarEstadoAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  // El cliente autenticado se convierte en la única raíz disponible en su portal.
  const clientesFuente: ClienteAPI[] = usuarioAutenticado?.rol === 'cliente'
    ? [{
        id: usuarioAutenticado.id,
        nombre: usuarioAutenticado.nombre,
        cedula: usuarioAutenticado.cedula,
        email: usuarioAutenticado.email,
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
        casos: casosDelCliente.map((as: AsuntoAPI) => ({
          id: as.id,
          codigo: as.radicado,
          nombre: 'Insolvencia Persona Natural',
          responsable: 'Equipo jurídico asignado',
          estadoBadge: as.estado?.nombre || 'En trámite',
          estadoTipo: (as.estado?.color_tipo as any) || 'mint',
          estadoId: as.estado?.id,
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
            autor: 'Equipo jurídico',
            fecha: new Date(nov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            texto: nov.descripcion,
            visibilidad: nov.publicado_al_cliente ? 'Cliente' : 'Interno'
          }))
        }))
      };
    });

  // Selección activa
  const clienteActivo = clientes.find(c => c.id === clienteIdSeleccionado) || clientes[0] || null;
  const casoActivo = clienteActivo && clienteActivo.casos ? (clienteActivo.casos.find(c => c.id === casoIdSeleccionado) || clienteActivo.casos[0] || null) : null;

  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');
  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('client');

  const handleGuardarEstado = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiConectada && casoActivo) {
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

    if (apiConectada && casoActivo) {
      mutacionNovedad.mutate({
        asuntoId: casoActivo.id,
        payload: {
          titulo: 'Avance procesal',
          descripcion: nuevoAvanceTexto,
          publicado_al_cliente: nuevoAvanceVisibilidad === 'client'
        }
      });
    }

    setNuevoAvanceTexto('');
  };

  const handleAuthenticated = (user: User) => {
    queryClient.setQueryData(['auth', 'me'], user);
    setUsuarioAutenticado(user);
    setView(user.rol === 'cliente' ? 'cliente' : 'firma');
  };

  const handleLogout = async () => {
    try {
      await logoutAPI();
    } finally {
      queryClient.clear();
      setUsuarioAutenticado(null);
      setView('firma');
      setSeccionFirma('expedientes');
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

  return (
    <div className="app-shell">
      <CrearClienteModal
        isOpen={crearClienteAbierto}
        isLoading={mutacionNuevoCliente.isPending}
        onClose={() => setCrearClienteAbierto(false)}
        onSubmit={(payload) => mutacionNuevoCliente.mutate(payload)}
      />
      <CrearAsuntoModal
        isOpen={crearAsuntoAbierto}
        isLoading={mutacionNuevoAsunto.isPending}
        cliente={clienteActivo!}
        responsableNombre={usuarioAutenticado.nombre}
        estados={estadosAPI || []}
        onClose={() => setCrearAsuntoAbierto(false)}
        onSubmit={(payload) => mutacionNuevoAsunto.mutate(payload)}
      />

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
                  : 'Oficina'}
            </span>
          </div>
        </div>

        <UserMenu
          user={usuarioAutenticado}
          onLogout={handleLogout}
          onOpenSettings={
            usuarioAutenticado.rol === 'administrador' && view === 'firma'
              ? () => setSeccionFirma('config_almacenamiento')
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
              {seccionFirma === 'config_almacenamiento' ? (
                <>
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
                    onClick={() => setSeccionFirma('expedientes')}
                  >
                    Volver a expedientes
                  </button>
                </>
              ) : (
                <>
                  <div className="section-title">
                    <h3>Clientes ({clientes.length})</h3>
                    <button className="icon-button" type="button" onClick={() => setCrearClienteAbierto(true)} title="Nuevo Cliente">
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="stack">
                    {clientes.length > 0 ? (
                      clientes.map(cli => (
                        <button
                          key={cli.id}
                          className={`client-entry ${clienteActivo && cli.id === clienteActivo.id ? 'active' : ''}`}
                          type="button"
                          onClick={() => {
                            setClienteIdSeleccionado(cli.id);
                            if (cli.casos && cli.casos.length > 0) {
                              setCasoIdSeleccionado(cli.casos[0].id);
                            }
                          }}
                        >
                          <strong>{cli.nombre}</strong>
                          <span className="muted small">{cli.casos ? cli.casos.length : 0} casos</span>
                        </button>
                      ))
                    ) : (
                      <div className="muted small" style={{ padding: '12px' }}>
                        Sin clientes registrados.
                      </div>
                    )}
                  </div>
                </>
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
            ) : clienteActivo ? (
              <>
                <div className="toolbar">
                  <div>
                    <h2>{clienteActivo.nombre}</h2>
                    <span className="muted">{clienteActivo.email} · CC/NIT: {clienteActivo.identificacion}</span>
                  </div>
                  <button className="primary-button" type="button" onClick={() => setCrearAsuntoAbierto(true)}>
                    <Plus size={16} />
                    Nuevo caso
                  </button>
                </div>

                <div className="workspace-flow">
                  <section className="panel case-nav-panel">
                    <div className="section-title">
                      <h3>Casos ({clienteActivo.casos ? clienteActivo.casos.length : 0})</h3>
                    </div>
                    <div className="case-list">
                      {clienteActivo.casos && clienteActivo.casos.length > 0 ? (
                        clienteActivo.casos.map(cs => (
                          <button 
                            key={cs.id}
                            className={`case-card ${casoActivo && cs.id === casoActivo.id ? 'active' : ''}`}
                            type="button"
                            onClick={() => setCasoIdSeleccionado(cs.id)}
                          >
                            <div className="case-card-header">
                              <div>
                                <strong>{cs.nombre}</strong>
                                <span className="muted small">{cs.codigo}</span>
                              </div>
                              <div className="case-card-badges">
                                <span className={`badge ${cs.estadoTipo}`}>{cs.estadoBadge}</span>
                              </div>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="muted small" style={{ padding: '16px' }}>
                          Sin expedientes. Haz clic en "Nuevo caso".
                        </div>
                      )}
                    </div>
                  </section>

                  {casoActivo ? (
                    <section>
                      <form className="panel" onSubmit={handleGuardarEstado}>
                        <div className="row between">
                          <div>
                            <h3>{casoActivo.nombre}</h3>
                            <span className="muted small">{casoActivo.codigo} · {casoActivo.responsable}</span>
                          </div>
                          <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                        </div>

                        <div className="form-grid" style={{ marginTop: '16px' }}>
                          <div className="field">
                            <label htmlFor="estado-procesal-select">
                              Estado Procesal
                              <Tooltip content="Cambia el estado público del asunto en la base de datos." />
                            </label>
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

                          <div className="field full">
                            <button className="secondary-button" type="submit">
                              <Save size={16} />
                              Guardar cambios
                            </button>
                          </div>
                        </div>
                      </form>

                      <FlujoAsunto
                        pasos={casoActivo.pasos}
                        flujoEstado={casoActivo.flujoEstado}
                        isLoading={mutacionAvanzarPaso.isPending}
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
                          <h3>Nuevo avance</h3>
                          <Eye size={17} />
                        </div>
                        <div className="form-grid">
                          <div className="field full">
                            <label htmlFor="update-body">Detalle de la novedad</label>
                            <textarea 
                              id="update-body" 
                              required
                              value={nuevoAvanceTexto}
                              onChange={(e) => setNuevoAvanceTexto(e.target.value)}
                              placeholder="Avance procesal..."
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
                              Publicar avance
                            </button>
                          </div>
                        </div>
                      </form>

                      <div className="panel">
                        <div className="section-title">
                          <h3>Timeline</h3>
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
                                    <strong>{n.autor}</strong>
                                    <span className="muted small">{n.fecha}</span>
                                  </div>
                                  <p style={{ margin: '4px 0' }}>{n.texto}</p>
                                  <span className={`badge ${n.visibilidad === 'Cliente' ? 'neutral' : 'warning'}`}>
                                    {n.visibilidad}
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="muted small" style={{ padding: '12px' }}>
                              Sin avances registrados.
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ) : (
                    <div className="panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
                      <h3>Sin expedientes para este cliente</h3>
                      <p className="muted small">Haz clic en "Nuevo caso" para aperturar el primer expediente.</p>
                      <button className="primary-button" style={{ margin: '16px auto 0' }} onClick={() => setCrearAsuntoAbierto(true)}>
                        <Plus size={16} /> Crear expediente
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
                <h3>No hay clientes registrados</h3>
                <p className="muted small" style={{ marginBottom: '16px' }}>
                  La base de datos está limpia. Registra tu primer cliente para comenzar las pruebas reales.
                </p>
                <button className="primary-button" style={{ margin: '0 auto' }} onClick={() => setCrearClienteAbierto(true)}>
                  <Plus size={16} /> Registrar primer cliente
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
