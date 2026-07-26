import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  LogOut, 
  X, 
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
  Database,
  UserCheck
} from 'lucide-react';
import { 
  fetchAsuntos, 
  fetchEstadosAPI, 
  crearNovedadAPI, 
  actualizarEstadoAPI, 
  AsuntoAPI, 
  EstadoProcesalAPI 
} from '@/features/asuntos/api/asuntos';
import { ClienteOTPLogin } from '@/features/auth/components/ClienteOTPLogin';
import { OficinaLogin } from '@/features/auth/components/OficinaLogin';

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
  requiereDocumento?: boolean;
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
  documentoPrincipal?: string;
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
    id: 'carlos-gomez',
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
        documentoPrincipal: 'Solicitud_Insolvencia_v1.pdf',
        milestones: [
          {
            id: 1,
            fecha: '01 de jul de 2026',
            titulo: 'Apertura de la evaluación de viabilidad',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 2,
            fecha: '26 de jul de 2026',
            titulo: 'Etapa 2: Negociación de Pasivos',
            estadoBadge: 'Actual',
            estadoItem: 'current',
            detalle: 'Estamos esperando el certificado de ingresos y extracto bancario actualizado para radicar observaciones.',
            subtexto: 'Cuando cargues el soporte en PDF, la abogada responsable lo revisará para continuar.',
            requiereDocumento: true
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
  
  // Usuario autenticado (null = muestra formulario de login)
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<any>(null);
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('carlos-gomez');
  const [casoIdSeleccionado, setCasoIdSeleccionado] = useState<string>('00000000-0000-0000-0000-000000000201');
  const [milestoneAbiertoId, setMilestoneAbiertoId] = useState<number | null>(2);

  // Consulta Asuntos
  const { data: asuntosAPI, isSuccess: apiConectada } = useQuery({
    queryKey: ['asuntos'],
    queryFn: fetchAsuntos,
    retry: 1,
  });

  // Consulta Estados Procesales Oficiales
  const { data: estadosAPI } = useQuery({
    queryKey: ['estados'],
    queryFn: fetchEstadosAPI,
    retry: 1,
  });

  // Mutación para Novedad
  const mutacionNovedad = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean } }) =>
      crearNovedadAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    },
  });

  // Mutación para Estado
  const mutacionEstado = useMutation({
    mutationFn: ({ asuntoId, payload }: { asuntoId: string; payload: { estado_id?: string; siguiente_paso?: string } }) =>
      actualizarEstadoAPI(asuntoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      alert('¡Estado procesal y próximo paso actualizados en PostgreSQL!');
    },
  });

  // Mapear datos reales
  const clientes: ClienteData[] = React.useMemo(() => {
    if (!asuntosAPI || asuntosAPI.length === 0) return mockClientesFallback;

    return [
      {
        id: 'carlos-gomez',
        nombre: 'Carlos Gómez Restrepo',
        contacto: 'Carlos Gómez',
        email: 'carlos.gomez@email.com',
        identificacion: '1.094.852.140',
        casos: asuntosAPI.map((as: AsuntoAPI) => ({
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
          documentoPrincipal: 'Solicitud_Insolvencia_v1.pdf',
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
              detalle: as.siguiente_paso,
              subtexto: 'Información registrada y sincronizada con el backend FastAPI.',
              requiereDocumento: true
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
      }
    ];
  }, [asuntosAPI]);

  const clienteActivo = clientes.find(c => c.id === clienteIdSeleccionado) || clientes[0];
  const casoActivo = clienteActivo.casos.find(c => c.id === casoIdSeleccionado) || clienteActivo.casos[0];

  // Estado formulario de edición
  const [estadoSeleccionadoId, setEstadoSeleccionadoId] = useState<string>('');
  const [proximoPasoForm, setProximoPasoForm] = useState(casoActivo.proximoPaso);

  // Estado nuevo avance
  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('client');

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

  // Si no se ha iniciado sesión, mostrar pantalla de autenticación según la vista seleccionada
  if (!usuarioAutenticado) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">A</div>
            <div>
              <h1>Asuntia</h1>
              <span>Acceso de Usuario</span>
            </div>
          </div>
          <div className="row wrap">
            <button 
              className="secondary-button" 
              type="button"
              onClick={() => setView(view === 'cliente' ? 'firma' : 'cliente')}
              style={{ fontWeight: 600, borderColor: 'var(--brand)', color: 'var(--brand)' }}
            >
              Cambiar a Vista: {view === 'cliente' ? '🛡️ Acceso Oficina' : '👤 Acceso Cliente (OTP)'}
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
          <span className={`badge ${apiConectada ? 'mint' : 'neutral'}`} style={{ gap: '4px' }}>
            <Database size={13} />
            {apiConectada ? 'BD PostgreSQL Conectada' : 'Modo Demo'}
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
              Vista: {view === 'cliente' ? '🛡️ Firma / Oficina' : '👤 Previsualización Cliente'}
            </button>
          )}

          <button 
            className="secondary-button" 
            type="button"
            onClick={() => setUsuarioAutenticado(null)}
          >
            <LogOut size={16} />
            Cerrar sesión
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
              <p className="muted">{clienteActivo.nombre} · Responsable: {casoActivo.responsable}</p>
            </div>
            <button className="secondary-button" type="button">
              <X size={16} />
              Consultar otro
            </button>
          </div>

          {casoActivo.solicitudPendiente && (
            <section className="client-action-card">
              <div>
                <span className="badge warning">Documento solicitado por tu abogada</span>
                <h3>{casoActivo.solicitudPendiente}</h3>
                <p>Por favor envía o entrega este soporte a tu abogada asignada para avanzar en el trámite.</p>
                <span className="muted small">Fecha límite sugerida: {casoActivo.fechaLimiteSolicitud || 'Próximamente'}</span>
              </div>
            </section>
          )}

          <section className="tracking-grid">
            <div className="panel tracking-main">
              <div>
                <div className="row between">
                  <h3>Estado del asunto</h3>
                  <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                </div>
                <p className="muted">Revisión de requisitos habilitantes y seguimiento al expediente.</p>
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

                      {milestoneAbiertoId === m.id && (
                        <div className="milestone-detail">
                          <p>{m.detalle || 'Detalle del avance registrado para esta etapa procesal.'}</p>
                          <span className="muted">{m.subtexto || 'Información sincronizada con el expediente.'}</span>
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
                        <span className="badge neutral" style={{ marginTop: '6px' }}>Cliente</span>
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
                <h3>Clientes</h3>
                <button className="icon-button" type="button">
                  <Plus size={16} />
                </button>
              </div>
              <div className="stack">
                {clientes.map(cli => (
                  <button 
                    key={cli.id}
                    className={`client-entry ${cli.id === clienteActivo.id ? 'active' : ''}`}
                    type="button"
                    onClick={() => setClienteIdSeleccionado(cli.id)}
                  >
                    <strong>{cli.nombre}</strong>
                    <span className="muted small">{cli.contacto}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="main">
            <div className="toolbar">
              <div>
                <h2>{clienteActivo.nombre}</h2>
                <span className="muted">{clienteActivo.email}</span>
              </div>
              <button className="primary-button" type="button">
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
                <span>Casos abiertos</span>
                <strong>{clientes.reduce((acc, curr) => acc + curr.casos.length, 0)}</strong>
              </div>
              <div className="metric">
                <span>Acción cliente</span>
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
                  <h3>Casos de {clienteActivo.nombre}</h3>
                  <span className="muted small">{clienteActivo.casos.length} activos</span>
                </div>
                <div className="case-list">
                  {clienteActivo.casos.map(cs => (
                    <button 
                      key={cs.id}
                      className={`case-card ${cs.id === casoActivo.id ? 'active' : ''}`}
                      type="button"
                      onClick={() => setCasoIdSeleccionado(cs.id)}
                    >
                      <div className="case-card-header">
                        <div>
                          <strong>{cs.nombre}</strong>
                          <span className="muted small">Radicado: {cs.codigo}</span>
                        </div>
                        <div className="case-card-badges">
                          <span className={`badge ${cs.estadoTipo}`}>{cs.estadoBadge}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              <section>
                {/* Formulario de Edición de Estado Procesal en PostgreSQL */}
                <form className="panel" onSubmit={handleGuardarEstado}>
                  <div className="row between">
                    <div>
                      <h3>{casoActivo.nombre}</h3>
                      <span className="muted small">Código: {casoActivo.codigo} · Responsable: {casoActivo.responsable}</span>
                    </div>
                    <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                  </div>

                  <div className="form-grid" style={{ marginTop: '16px' }}>
                    <div className="field">
                      <label htmlFor="estado-procesal-select">Estado Procesal Oficial (PostgreSQL)</label>
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
                        Guardar cambios en BD
                      </button>
                    </div>
                  </div>
                </form>

                <form className="panel" onSubmit={handlePublicarAvance}>
                  <div className="section-title">
                    <h3>Nuevo avance / novedad</h3>
                    <Eye size={17} />
                  </div>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="update-body">Detalle del avance</label>
                      <textarea 
                        id="update-body" 
                        required
                        value={nuevoAvanceTexto}
                        onChange={(e) => setNuevoAvanceTexto(e.target.value)}
                        placeholder="Escribe el avance que quedará guardado en la BD..."
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
                    <h3>Timeline de {casoActivo.nombre}</h3>
                    <History size={17} />
                  </div>

                  <div className="timeline">
                    {casoActivo.novedades.map((n) => (
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
                    ))}
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
