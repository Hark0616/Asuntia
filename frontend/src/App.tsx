import React, { useState } from 'react';
import { 
  LogOut, 
  X, 
  FileText, 
  CircleCheck, 
  ChevronRight, 
  ChevronDown, 
  CalendarClock, 
  History, 
  Plus, 
  Save, 
  Eye, 
  Send, 
  Clock3 
} from 'lucide-react';

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

const mockClientesIniciales: ClienteData[] = [
  {
    id: 'carlos-gomez',
    nombre: 'Carlos Gómez Restrepo',
    contacto: 'Carlos Gómez',
    email: 'carlos.gomez@email.com',
    identificacion: '1.094.852.140',
    casos: [
      {
        id: 'case-insolvencia',
        codigo: 'AS-2026-001',
        nombre: 'Insolvencia Persona Natural',
        responsable: 'Dra. Daniela Torres',
        estadoBadge: 'Requiere cliente',
        estadoTipo: 'warning',
        prioridad: 'alta',
        proximoPaso: 'Recibir certificado de ingresos y extracto bancario actualizado.',
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
            fecha: '10 de jul de 2026',
            titulo: 'Revisión y consolidación de acreencias',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 3,
            fecha: '26 de jul de 2026',
            titulo: 'Recolección de evidencia documental',
            estadoBadge: 'Actual',
            estadoItem: 'current',
            detalle: 'Estamos esperando el certificado de ingresos y extracto bancario actualizado para radicar observaciones.',
            subtexto: 'Cuando cargues el soporte en PDF, la abogada responsable lo revisará para continuar.',
            requiereDocumento: true
          },
          {
            id: 4,
            fecha: '05 de ago de 2026',
            titulo: 'Radicación de la solicitud de negociación',
            estadoBadge: 'Siguiente',
            tipoBadge: 'neutral',
            estadoItem: 'upcoming'
          },
          {
            id: 5,
            fecha: '15 de ago de 2026',
            titulo: 'Audiencia de negociación de pasivos',
            estadoBadge: 'Siguiente',
            tipoBadge: 'neutral',
            estadoItem: 'upcoming'
          }
        ],
        novedades: [
          {
            id: 'n1',
            autor: 'Dra. Daniela Torres',
            fecha: '26 de jul, 09:15 a. m.',
            texto: 'El Centro de Conciliación admitió la solicitud de negociación de pasivos de acuerdo con la Ley 2445.',
            visibilidad: 'Cliente'
          },
          {
            id: 'n2',
            autor: 'Dra. Daniela Torres',
            fecha: '24 de jul, 04:30 p. m.',
            texto: 'Pendiente validar internamente con el contador la clasificación de acreencia de vivienda.',
            visibilidad: 'Interno'
          }
        ]
      }
    ]
  },
  {
    id: 'constructora-norte',
    nombre: 'Constructora Norte S.A.S.',
    contacto: 'Laura Mejía',
    email: 'laura@constructoranorte.co',
    identificacion: 'NIT 900.542.118-4',
    casos: [
      {
        id: 'case-licitacion',
        codigo: 'AS-2026-002',
        nombre: 'Licitación Municipal 2026',
        responsable: 'Dra. Daniela Torres',
        estadoBadge: 'Requiere cliente',
        estadoTipo: 'warning',
        prioridad: 'alta',
        proximoPaso: 'Recibir certificado de experiencia actualizado en PDF.',
        solicitudPendiente: 'Certificado de experiencia',
        fechaLimiteSolicitud: '08 de jul de 2026',
        documentoPrincipal: 'Pliego_condiciones_v2.pdf',
        milestones: [
          {
            id: 1,
            fecha: '01 de jul de 2026',
            titulo: 'Apertura del asunto',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 2,
            fecha: '03 de jul de 2026',
            titulo: 'Revisión inicial de pliegos',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 3,
            fecha: '08 de jul de 2026',
            titulo: 'Recolección de evidencia',
            estadoBadge: 'Actual',
            estadoItem: 'current',
            detalle: 'Estamos esperando el certificado de experiencia actualizado para continuar con observaciones.',
            subtexto: 'Cuando el cliente cargue el soporte, el equipo lo revisará y definirá si queda listo para radicar.',
            requiereDocumento: true
          },
          {
            id: 4,
            fecha: '10 de jul de 2026',
            titulo: 'Radicación de observaciones',
            estadoBadge: 'Siguiente',
            tipoBadge: 'neutral',
            estadoItem: 'upcoming'
          },
          {
            id: 5,
            fecha: '15 de jul de 2026',
            titulo: 'Seguimiento a respuesta',
            estadoBadge: 'Siguiente',
            tipoBadge: 'neutral',
            estadoItem: 'upcoming'
          }
        ],
        novedades: [
          {
            id: 'n3',
            autor: 'Dra. Daniela Torres',
            fecha: '04 de jul, 09:25 a. m.',
            texto: 'Pendiente validar internamente si conviene presentar observación adicional.',
            visibilidad: 'Interno'
          },
          {
            id: 'n4',
            autor: 'Dra. Daniela Torres',
            fecha: '04 de jul, 09:15 a. m.',
            texto: 'Se revisaron los requisitos habilitantes y se identificó un documento pendiente.',
            visibilidad: 'Cliente'
          }
        ]
      },
      {
        id: 'case-contrato',
        codigo: 'AS-2026-003',
        nombre: 'Contrato de Obra con Proveedor',
        responsable: 'Dr. Carlos Rojas',
        estadoBadge: 'En curso',
        estadoTipo: 'mint',
        prioridad: 'normal',
        proximoPaso: 'Revisión de cláusula de garantía procesal.',
        documentoPrincipal: 'Minuta_Contrato_v1.pdf',
        milestones: [
          {
            id: 1,
            fecha: '01 de jul de 2026',
            titulo: 'Recepción de minuta contractual',
            estadoBadge: 'Completado',
            estadoItem: 'completed'
          },
          {
            id: 2,
            fecha: '05 de jul de 2026',
            titulo: 'Revisión de riesgos jurídicos',
            estadoBadge: 'Actual',
            estadoItem: 'current',
            detalle: 'En análisis de penalidades por incumplimiento con la aseguradora.',
            subtexto: 'Revisión en curso por el equipo legal.',
            requiereDocumento: false
          }
        ],
        novedades: [
          {
            id: 'n5',
            autor: 'Dr. Carlos Rojas',
            fecha: '03 de jul, 02:00 p. m.',
            texto: 'Se enviaron comentarios a la aseguradora para ajuste de póliza.',
            visibilidad: 'Cliente'
          }
        ]
      }
    ]
  }
];

export default function App() {
  const [view, setView] = useState<'cliente' | 'firma'>('firma');
  const [clientes, setClientes] = useState<ClienteData[]>(mockClientesIniciales);
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState<string>('carlos-gomez');
  const [casoIdSeleccionado, setCasoIdSeleccionado] = useState<string>('case-insolvencia');
  
  // Obtener cliente y caso activo
  const clienteActivo = clientes.find(c => c.id === clienteIdSeleccionado) || clientes[0];
  const casoActivo = clienteActivo.casos.find(c => c.id === casoIdSeleccionado) || clienteActivo.casos[0];

  // Estado del formulario de edición del caso
  const [estadoProcesalForm, setEstadoProcesalForm] = useState('requiere_cliente');
  const [prioridadForm, setPrioridadForm] = useState<'alta' | 'normal'>(casoActivo.prioridad);
  const [proximoPasoForm, setProximoPasoForm] = useState(casoActivo.proximoPaso);

  // Estado de nuevo avance
  const [nuevoAvanceTexto, setNuevoAvanceTexto] = useState('');
  const [nuevoAvanceVisibilidad, setNuevoAvanceVisibilidad] = useState<'client' | 'internal'>('client');

  // Cambiar de cliente en el sidebar
  const handleSeleccionarCliente = (cliente: ClienteData) => {
    setClienteIdSeleccionado(cliente.id);
    setCasoIdSeleccionado(cliente.casos[0].id);
    setProximoPasoForm(cliente.casos[0].proximoPaso);
    setPrioridadForm(cliente.casos[0].prioridad);
  };

  // Cambiar de caso
  const handleSeleccionarCaso = (caso: CasoData) => {
    setCasoIdSeleccionado(caso.id);
    setProximoPasoForm(caso.proximoPaso);
    setPrioridadForm(caso.prioridad);
  };

  // Guardar cambios en el caso
  const handleGuardarCaso = (e: React.FormEvent) => {
    e.preventDefault();
    setClientes(prevClientes => prevClientes.map(c => {
      if (c.id !== clienteActivo.id) return c;
      return {
        ...c,
        casos: c.casos.map(cs => {
          if (cs.id !== casoActivo.id) return cs;
          return {
            ...cs,
            prioridad: prioridadForm,
            proximoPaso: proximoPasoForm
          };
        })
      };
    }));
    alert('¡Caso guardado exitosamente!');
  };

  // Publicar un avance
  const handlePublicarAvance = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoAvanceTexto.trim()) return;

    const visibilidadTexto = nuevoAvanceVisibilidad === 'client' ? 'Cliente' : 'Interno';
    const nuevaNovedad: NovedadItem = {
      id: Date.now().toString(),
      autor: 'Dra. Daniela Torres',
      fecha: 'Hace un momento',
      texto: nuevoAvanceTexto,
      visibilidad: visibilidadTexto
    };

    setClientes(prevClientes => prevClientes.map(c => {
      if (c.id !== clienteActivo.id) return c;
      return {
        ...c,
        casos: c.casos.map(cs => {
          if (cs.id !== casoActivo.id) return cs;
          return {
            ...cs,
            novedades: [nuevaNovedad, ...cs.novedades]
          };
        })
      };
    }));

    setNuevoAvanceTexto('');
  };

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
          {/* Switch de vista para prueba */}
          <button 
            className="secondary-button" 
            type="button"
            onClick={() => setView(view === 'cliente' ? 'firma' : 'cliente')}
            style={{ fontWeight: 600, borderColor: 'var(--brand)', color: 'var(--brand)' }}
          >
            Cambiar a Vista: {view === 'cliente' ? '🛡️ Firma / Oficina' : '👤 Cliente'}
          </button>

          <button className="secondary-button" type="button">
            <LogOut size={16} />
            {view === 'cliente' ? 'Cerrar consulta' : 'Salir'}
          </button>
        </div>
      </header>

      {/* =================================================== */}
      {/* VISTA DEL CLIENTE (/cliente?codigo=AS-2026-001)       */}
      {/* =================================================== */}
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

          {/* Tarjeta de Acción Requerida */}
          {casoActivo.solicitudPendiente && (
            <section className="client-action-card">
              <div>
                <span className="badge warning">Requiere cliente</span>
                <h3>{casoActivo.solicitudPendiente}</h3>
                <p>Por favor adjunta el documento actualizado en formato PDF para avanzar.</p>
                <span className="muted small">Fecha límite: {casoActivo.fechaLimiteSolicitud || 'Próximamente'}</span>
              </div>
              <a className="primary-button" href="#client-evidence">
                <FileText size={16} />
                Subir documento
              </a>
            </section>
          )}

          {/* Grid Principal de Seguimiento */}
          <section className="tracking-grid">
            <div className="panel tracking-main">
              <div>
                <div className="row between">
                  <h3>Estado del asunto</h3>
                  <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                </div>
                <p className="muted">Revisión de requisitos habilitantes y seguimiento al expediente.</p>
              </div>

              {/* Milestones Stepper */}
              <div className="milestone-list">
                {casoActivo.milestones.map((m) => (
                  <article key={m.id} className={`milestone-item milestone-${m.estadoItem}`}>
                    <div className="milestone-rail">
                      <div className="milestone-marker">
                        {m.estadoItem === 'completed' ? (
                          <CircleCheck size={16} />
                        ) : (
                          m.id
                        )}
                      </div>
                      {m.id < casoActivo.milestones.length && <div className="milestone-line"></div>}
                    </div>

                    <div className="milestone-card">
                      <button className="milestone-head" type="button">
                        <div>
                          <span className="muted small">{m.fecha}</span>
                          <strong>{m.titulo}</strong>
                        </div>
                        <div className="row">
                          <span className={`badge ${m.tipoBadge || 'neutral'}`}>{m.estadoBadge}</span>
                          {m.estadoItem === 'current' ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                        </div>
                      </button>

                      {m.estadoItem === 'current' && (
                        <div className="milestone-detail">
                          <p>{m.detalle}</p>
                          <span className="muted">{m.subtexto}</span>

                          {m.requiereDocumento && (
                            <div className="evidence-box" id="client-evidence">
                              <div>
                                <strong>Sube el documento solicitado</strong>
                                <p className="muted">Selecciona el archivo en PDF y confirma el envío a tu abogada.</p>
                              </div>
                              <div className="tracking-input-row" style={{ display: 'flex', gap: '10px' }}>
                                <label className="file-picker">
                                  <FileText size={16} />
                                  <span>Seleccionar archivo PDF</span>
                                  <input type="file" accept=".pdf" />
                                </label>
                                <button className="primary-button" type="button">
                                  Enviar documento
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            {/* Sidebar Derecho del Cliente */}
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

              {casoActivo.solicitudPendiente && (
                <div className="panel">
                  <div className="section-title">
                    <h3>Solicitudes</h3>
                    <CalendarClock size={17} />
                  </div>
                  <div className="stack">
                    <div className="list-card">
                      <div className="row between">
                        <div>
                          <strong>{casoActivo.solicitudPendiente}</strong>
                          <span className="muted small">{clienteActivo.contacto} · vence {casoActivo.fechaLimiteSolicitud}</span>
                        </div>
                        <span className="badge warning">Pendiente</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {casoActivo.documentoPrincipal && (
                <div className="panel">
                  <div className="section-title">
                    <h3>Documentos</h3>
                    <FileText size={17} />
                  </div>
                  <div className="stack">
                    <div className="list-card">
                      <div className="row between">
                        <div>
                          <strong>{casoActivo.documentoPrincipal}</strong>
                          <span className="muted small">Expediente · 10 de jul de 2026</span>
                        </div>
                        <span className="badge neutral">Cliente</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

      {/* =================================================== */}
      {/* VISTA DE LA FIRMA / OFICINA (/firma)                */}
      {/* =================================================== */}
      {view === 'firma' && (
        <div className="layout">
          {/* Sidebar Interactivo de Clientes */}
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
                    onClick={() => handleSeleccionarCliente(cli)}
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

            {/* Metricas de la Firma */}
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
                <strong>2</strong>
              </div>
            </div>

            <div className="workspace-flow">
              {/* Selector de Casos del Cliente Seleccionado */}
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
                      onClick={() => handleSeleccionarCaso(cs)}
                    >
                      <div className="case-card-header">
                        <div>
                          <strong>{cs.nombre}</strong>
                          <span className="muted small">Código: {cs.codigo}</span>
                        </div>
                        <div className="case-card-badges">
                          <span className={`badge ${cs.estadoTipo}`}>{cs.estadoBadge}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Panel de Edicion del Caso Seleccionado */}
              <section>
                <div className="panel">
                  <div className="row between">
                    <div>
                      <h3>{casoActivo.nombre}</h3>
                      <span className="muted small">Código: {casoActivo.codigo} · Responsable: {casoActivo.responsable}</span>
                    </div>
                    <span className={`badge ${casoActivo.estadoTipo}`}>{casoActivo.estadoBadge}</span>
                  </div>
                  <p className="muted" style={{ margin: '8px 0 16px' }}>
                    Revisión de pliegos, requisitos habilitantes y observaciones del expediente.
                  </p>

                  <form className="form-grid" onSubmit={handleGuardarCaso}>
                    <div className="field">
                      <label htmlFor="case-status">Estado</label>
                      <select 
                        id="case-status" 
                        value={estadoProcesalForm} 
                        onChange={(e) => setEstadoProcesalForm(e.target.value)}
                      >
                        <option value="nuevo">Nuevo</option>
                        <option value="en_curso">En curso</option>
                        <option value="requiere_cliente">Requiere cliente</option>
                        <option value="en_espera">En espera</option>
                        <option value="finalizado">Finalizado</option>
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="case-priority">Prioridad</label>
                      <select 
                        id="case-priority"
                        value={prioridadForm}
                        onChange={(e) => setPrioridadForm(e.target.value as 'alta' | 'normal')}
                      >
                        <option value="normal">Normal</option>
                        <option value="alta">Alta</option>
                      </select>
                    </div>

                    <div className="field full">
                      <label htmlFor="next-step">Próximo paso</label>
                      <textarea 
                        id="next-step"
                        value={proximoPasoForm}
                        onChange={(e) => setProximoPasoForm(e.target.value)}
                      />
                    </div>

                    <div className="field full">
                      <button className="secondary-button" type="submit">
                        <Save size={16} />
                        Guardar caso
                      </button>
                    </div>
                  </form>
                </div>

                {/* Formulario de Nuevo Avance */}
                <form className="panel" onSubmit={handlePublicarAvance}>
                  <div className="section-title">
                    <h3>Nuevo avance</h3>
                    <Eye size={17} />
                  </div>
                  <div className="form-grid">
                    <div className="field full">
                      <label htmlFor="update-body">Detalle</label>
                      <textarea 
                        id="update-body" 
                        required
                        value={nuevoAvanceTexto}
                        onChange={(e) => setNuevoAvanceTexto(e.target.value)}
                        placeholder="Escribe la novedad procesal..."
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="update-visibility">Visibilidad</label>
                      <select 
                        id="update-visibility"
                        value={nuevoAvanceVisibilidad}
                        onChange={(e) => setNuevoAvanceVisibilidad(e.target.value as 'client' | 'internal')}
                      >
                        <option value="client">Cliente</option>
                        <option value="internal">Interno</option>
                      </select>
                    </div>

                    <div className="field">
                      <label>&nbsp;</label>
                      <button className="primary-button" type="submit">
                        <Send size={16} />
                        Publicar
                      </button>
                    </div>
                  </div>
                </form>

                {/* Timeline Interno */}
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
