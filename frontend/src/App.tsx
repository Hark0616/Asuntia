import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  LogOut, 
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
  UserCheck
} from 'lucide-react';
import { 
  fetchAsuntos, 
  fetchEstadosAPI, 
  fetchClientesAPI,
  crearClienteAPI,
  crearAsuntoAPI,
  crearNovedadAPI, 
  actualizarEstadoAPI, 
  AsuntoAPI, 
  EstadoProcesalAPI,
  ClienteAPI
} from '@/features/asuntos/api/asuntos';
import { ClienteOTPLogin } from '@/features/auth/components/ClienteOTPLogin';
import { OficinaLogin } from '@/features/auth/components/OficinaLogin';
import { Tooltip } from '@/components/ui/Tooltip';

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
}

interface ClienteData {
  id: string;
  nombre: string;
  contacto: string;
  email: string;
  identificacion: string;
  casos: CasoData[];
}

const mockClientesFallback: ClienteData[] = [
  {
    id: '00000000-0000-0000-0000-000000000020',
    nombre: 'Carlos Gómez Restrepo',
    contacto: 'Carlos Gómez',
    email: 'carlos.gomez@email.com',
    identificacion: '1.094.852.140',
    casos: [
      {
        id: '00000000-0000-0000-0000-000000000201',
        codigo: 'AS-2026-001',
        nombre: 'Insolvencia Persona Natural',
        responsable: 'Dra. Daniela Torres',
        estadoBadge: 'Admitido en Centro de Conciliación',
        estadoTipo: 'mint',
        prioridad: 'alta',
        proximoPaso: 'Fijación de fecha para primera audiencia de negociación',
        solicitudPendiente: 'Certificado de ingresos y estado de cuenta',
        fechaLimiteSolicitud: '08 de ago de 2026',
        milestones: [
          {
            id: 1,
            fecha: '01 de jul de 2026',
            titulo: 'Apertura de evaluación de viabilidad',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 2,
            fecha: '26 de jul de 2026',
            titulo: 'Etapa 2: Negociación de Pasivos',
            estadoBadge: 'Actual',
            estadoItem: 'current',
            detalle: 'Esperando soporte de ingresos y extracto bancario para observaciones.'
          }
        ],
        novedades: [
          {
            id: 'n1',
            autor: 'Dra. Daniela Torres',
            fecha: '26 de jul, 09:15 a. m.',
            texto: 'El Centro de Conciliación admitió la solicitud de negociación de pasivos de acuerdo con la Ley 2445.',
            visibilidad: 'Cliente'
          }
        ]
      }
    ]
  }
];

export default function App() {
  const queryClient = useQueryClient();
  
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<any>(null);
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('00000000-0000-0000-0000-000000000020');
  const [casoIdSeleccionado, setCasoIdSeleccionado] = useState<string>('00000000-0000-0000-0000-000000000201');
  const [milestoneAbiertoId, setMilestoneAbiertoId] = useState<number | null>(2);

  // Consultas API
  const { data: asuntosAPI, isSuccess: apiConectada } = useQuery({ queryKey: ['asuntos'], queryFn: fetchAsuntos, retry: 1 });
  const { data: estadosAPI } = useQuery({ queryKey: ['estados'], queryFn: fetchEstadosAPI, retry: 1 });
  const { data: clientesAPI } = useQuery({ queryKey: ['clientes'], queryFn: fetchClientesAPI, retry: 1 });

  // Mutaciones
  const mutacionNuevoCliente = useMutation({
    mutationFn: (payload: { nombre: string; cedula: string; email: string }) => crearClienteAPI(payload),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      setClienteIdSeleccionado(newClient.id);
    }
  });

  const mutacionNuevoAsunto = useMutation({
    mutationFn: (payload: { radicado: string; cliente_id: string; etapa_actual?: string; siguiente_paso?: string }) => crearAsuntoAPI(payload),
    onSuccess: (newAsunto) => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      setCasoIdSeleccionado(newAsunto.id);
    }
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

  // Mapeo dinámico
  const clientes: ClienteData[] = React.useMemo(() => {
    if (!clientesAPI || clientesAPI.length === 0) return mockClientesFallback;

    return clientesAPI.map((cli: ClienteAPI) => {
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
          responsable: 'Dra. Daniela Torres',
          estadoBadge: as.estado?.nombre || 'En trámite',
          estadoTipo: (as.estado?.color_tipo as any) || 'mint',
          estadoId: as.estado?.id,
          prioridad: 'alta' as const,
          proximoPaso: as.siguiente_paso,
          solicitudPendiente: 'Certificado de ingresos y estado de cuenta',
          fechaLimiteSolicitud: '08 de ago de 2026',
          milestones: [
            {
              id: 1,
              fecha: '01 de jul de 2026',
              titulo: 'Apertura de evaluación de viabilidad',
              estadoBadge: 'Completado',
              estadoItem: 'completed'
            },
            {
              id: 2,
              fecha: '26 de jul de 2026',
              titulo: as.etapa_actual,
              estadoBadge: 'Actual',
              estadoItem: 'current',
              detalle: as.siguiente_paso
            }
          ],
          novedades: as.novedades.map(nov => ({
            id: nov.id,
            autor: 'Dra. Daniela Torres',
            fecha: new Date(nov.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            texto: nov.descripcion,
            visibilidad: nov.publicado_al_cliente ? 'Cliente' : 'Interno'
          }))
        }))
      };
    });
  }, [clientesAPI, asuntosAPI]);

  const clienteActivo = clientes.find(c => c.id === clienteIdSeleccionado) || clientes[0] || mockClientesFallback[0];
  const casoActivo = (clienteActivo.casos && clienteActivo.casos.find(c => c.id === casoIdSeleccionado)) || clienteActivo.casos[0] || {
    id: '00000000-0000-0000-0000-000000000201',
    codigo: 'AS-2026-001',
    nombre: 'Insolvencia Persona Natural',
    responsable: 'Dra. Daniela Torres',
    estadoBadge: 'Sin casos activos',
    estadoTipo: 'neutral',
    prioridad: 'normal',
    proximoPaso: 'Crear nuevo expediente',
    milestones: [],
    novedades: []
  };

  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');
  const [proximoPasoForm, setProximoPasoForm] = useState(casoActivo.proximoPaso);

  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('client');

  const handleCrearClientePrompt = () => {
    const nombre = prompt('Nombre del nuevo cliente:');
    if (!nombre) return;
    const cedula = prompt('Cédula o NIT:');
    if (!cedula) return;
    const email = prompt('Correo electrónico:');
    if (!email) return;

    mutacionNuevoCliente.mutate({ nombre, cedula, email });
  };

  const handleCrearAsuntoPrompt = () => {
    const radicado = prompt(`Radicado para ${clienteActivo.nombre} (Ej: AS-2026-003):`);
    if (!radicado) return;
    const paso = prompt('Próximo paso:', 'Revisión inicial de documentación');

    mutacionNuevoAsunto.mutate({
      radicado,
      cliente_id: clienteActivo.id,
      siguiente_paso: paso || 'Revisión inicial'
    });
  };

  const handleGuardarEstado = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiConectada && casoActivo.id) {
      mutacionEstado.mutate({
        asuntoId: casoActivo.id,
        payload: {
          estado_id: estadoSeleccionadoId || casoActivo.estadoId,
          siguiente_paso: proximoPasoForm
        }
      });
    }
  };

  const handlePublicarAvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoAvanceTexto.trim()) return;

    if (apiConectada && casoActivo.id) {
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
          <ClienteOTPLogin onSuccess={(user) => { setUsuarioAutenticado(user); setView('cliente'); }} />
        ) : (
          <OficinaLogin onSuccess={(user) => { setUsuarioAutenticado(user); setView('firma'); }} />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <h1>Asuntia</h1>
            <span>{view === 'cliente' ? casoActivo.codigo : 'Firma'}</span>
          </div>
        </div>

        <div className="row wrap">
          <span className={`badge ${apiConectada ? 'mint' : 'neutral'}`} style={{ gap: '6px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: apiConectada ? '#10b981' : '#94a3b8' }}></span>
            {apiConectada ? 'BD Conectada' : 'Demo'}
          </span>

          <span className="badge neutral" style={{ gap: '4px' }}>
            <UserCheck size={13} />
            {usuarioAutenticado.nombre}
          </span>

          {usuarioAutenticado.rol !== 'cliente' && (
            <button 
              className="secondary-button" 
              type="button"
              onClick={() => setView(view === 'cliente' ? 'firma' : 'cliente')}
              style={{ fontWeight: 600, borderColor: 'var(--brand)', color: 'var(--brand)' }}
            >
              {view === 'cliente' ? '🛡️ Oficina' : '👤 Vista Cliente'}
            </button>
          )}

          <button 
            className="secondary-button" 
            type="button"
            onClick={() => setUsuarioAutenticado(null)}
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      {/* VISTA CLIENTE */}
      {view === 'cliente' && (
        <section className="main tracking-shell">
          <div className="tracking-header">
            <div>
              <span className="badge neutral">{casoActivo.codigo}</span>
              <h2>{casoActivo.nombre}</h2>
              <p className="muted">{clienteActivo.nombre} · {casoActivo.responsable}</p>
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
        </section>
      )}

      {/* VISTA FIRMA */}
      {view === 'firma' && (
        <div className="layout">
          <aside className="sidebar">
            <div className="sidebar-inner">
              <div className="section-title">
                <h3>Clientes ({clientes.length})</h3>
                <button className="icon-button" type="button" onClick={handleCrearClientePrompt} title="Nuevo Cliente">
                  <Plus size={16} />
                </button>
              </div>
              <div className="stack">
                {clientes.map(cli => (
                  <button 
                    key={cli.id}
                    className={`client-entry ${cli.id === clienteActivo.id ? 'active' : ''}`}
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
                ))}
              </div>
            </div>
          </aside>

          <section className="main">
            <div className="toolbar">
              <div>
                <h2>{clienteActivo.nombre}</h2>
                <span className="muted">{clienteActivo.email} · CC/NIT: {clienteActivo.identificacion}</span>
              </div>
              <button className="primary-button" type="button" onClick={handleCrearAsuntoPrompt}>
                <Plus size={16} />
                Nuevo caso
              </button>
            </div>

            <div className="grid metrics">
              <div className="metric">
                <span>Clientes</span>
                <strong>{clientes.length}</strong>
              </div>
              <div className="metric">
                <span>Casos Activos</span>
                <strong>{clientes.reduce((acc, curr) => acc + (curr.casos ? curr.casos.length : 0), 0)}</strong>
              </div>
              <div className="metric">
                <span>Pendientes</span>
                <strong>1</strong>
              </div>
              <div className="metric">
                <span>Solicitudes</span>
                <strong>1</strong>
              </div>
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
                        className={`case-card ${cs.id === casoActivo.id ? 'active' : ''}`}
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
                      <label htmlFor="next-step">Próximo paso para el cliente</label>
                      <textarea 
                        id="next-step"
                        value={proximoPasoForm}
                        onChange={(e) => setProximoPasoForm(e.target.value)}
                      />
                    </div>
                    
                    <div className="field full">
                      <button className="secondary-button" type="submit">
                        <Save size={16} />
                        Guardar cambios
                      </button>
                    </div>
                  </div>
                </form>

                <form className="panel" onSubmit={handlePublicarAvance}>
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
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
