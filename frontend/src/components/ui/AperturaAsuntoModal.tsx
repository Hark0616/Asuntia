import { useEffect, useState } from 'react';
import {
  Building2,
  CircleCheck,
  FolderPlus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';

import type {
  AperturaAsuntoPayload,
  ClienteAPI,
  ClienteCreatePayload,
  ResponsableAPI,
} from '@/features/asuntos/api/asuntos';
import type { User } from '@/types/api';

type OpeningTab = 'existing' | 'new';

interface AperturaAsuntoModalProps {
  isOpen: boolean;
  clientes: ClienteAPI[];
  responsables: ResponsableAPI[];
  usuarioActual: User;
  clienteInicialId?: string;
  isLoading?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (payload: AperturaAsuntoPayload) => void;
}

interface NewClientForm {
  tipo_persona: ClienteCreatePayload['tipo_persona'];
  tipo_documento: ClienteCreatePayload['tipo_documento'];
  numero_documento: string;
  nombre: string;
  email: string;
  telefono: string;
  fecha_expedicion: string;
  direccion: string;
  direccion_notificacion: string;
  ciudad: string;
  departamento: string;
  canal_preferido: ClienteCreatePayload['canal_preferido'];
  observaciones: string;
  habilitar_portal: boolean;
}

const emptyClientForm = (): NewClientForm => ({
  tipo_persona: 'natural',
  tipo_documento: 'CC',
  numero_documento: '',
  nombre: '',
  email: '',
  telefono: '',
  fecha_expedicion: '',
  direccion: '',
  direccion_notificacion: '',
  ciudad: '',
  departamento: '',
  canal_preferido: 'email',
  observaciones: '',
  habilitar_portal: true,
});

function getLocalDateInputValue() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function optionalValue(value: string) {
  return value.trim() || undefined;
}

export function AperturaAsuntoModal({
  isOpen,
  clientes,
  responsables,
  usuarioActual,
  clienteInicialId,
  isLoading = false,
  errorMessage,
  onClose,
  onSubmit,
}: AperturaAsuntoModalProps) {
  const [activeTab, setActiveTab] = useState<OpeningTab>('existing');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [responsableId, setResponsableId] = useState('');
  const [openingDate, setOpeningDate] = useState(getLocalDateInputValue);
  const [newClient, setNewClient] = useState<NewClientForm>(emptyClientForm);

  useEffect(() => {
    if (!isOpen) return;
    const canAssignSelf = responsables.some(
      (responsable) => responsable.id === usuarioActual.id,
    );
    setActiveTab('existing');
    setSearchTerm('');
    setSelectedClientId(clienteInicialId || '');
    setResponsableId(
      canAssignSelf ? usuarioActual.id : (responsables[0]?.id || ''),
    );
    setOpeningDate(getLocalDateInputValue());
    setNewClient(emptyClientForm());
  }, [
    isOpen,
    clienteInicialId,
    responsables,
    usuarioActual.id,
  ]);

  if (!isOpen) return null;

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('es-CO');
  const filteredClients = clientes.filter((cliente) => {
    if (!normalizedSearch) return true;
    return [
      cliente.nombre,
      cliente.numero_documento,
      cliente.email,
      cliente.telefono || '',
    ].some((value) => value.toLocaleLowerCase('es-CO').includes(normalizedSearch));
  });
  const selectedClient = clientes.find(
    (cliente) => cliente.id === selectedClientId,
  );
  const canSubmitExisting = Boolean(selectedClientId && responsableId);
  const canSubmitNew = Boolean(
    newClient.nombre.trim()
    && newClient.numero_documento.trim()
    && newClient.email.trim()
    && responsableId,
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (activeTab === 'existing') {
      if (!canSubmitExisting) return;
      onSubmit({
        cliente_id: selectedClientId,
        abogado_id: responsableId,
        fecha_apertura: openingDate,
      });
      return;
    }
    if (!canSubmitNew) return;
    onSubmit({
      cliente_nuevo: {
        tipo_persona: newClient.tipo_persona,
        tipo_documento: newClient.tipo_documento,
        numero_documento: newClient.numero_documento.trim(),
        nombre: newClient.nombre.trim(),
        email: newClient.email.trim(),
        telefono: optionalValue(newClient.telefono),
        fecha_expedicion: optionalValue(newClient.fecha_expedicion),
        direccion: optionalValue(newClient.direccion),
        direccion_notificacion: optionalValue(
          newClient.direccion_notificacion,
        ),
        ciudad: optionalValue(newClient.ciudad),
        departamento: optionalValue(newClient.departamento),
        canal_preferido: newClient.canal_preferido,
        observaciones: optionalValue(newClient.observaciones),
        habilitar_portal: newClient.habilitar_portal,
      },
      abogado_id: responsableId,
      fecha_apertura: openingDate,
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!isLoading) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isLoading) onClose();
      }}
    >
      <section
        className="modal-content opening-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="opening-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header opening-modal-header">
          <div className="opening-title">
            <span className="opening-title-icon" aria-hidden="true">
              <FolderPlus size={20} />
            </span>
            <div>
              <h3 id="opening-modal-title">Abrir un asunto</h3>
              <span className="muted small">
                Vincula un cliente del directorio o registra uno nuevo.
              </span>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Cerrar"
          >
            <X size={17} />
          </button>
        </header>

        <form className="opening-form" onSubmit={handleSubmit}>
          <div className="opening-tabs" role="tablist" aria-label="Origen del cliente">
            <button
              id="existing-client-tab"
              className={activeTab === 'existing' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === 'existing'}
              aria-controls="existing-client-panel"
              onClick={() => setActiveTab('existing')}
            >
              <Building2 size={17} />
              Directorio de clientes
              <span>{clientes.length}</span>
            </button>
            <button
              id="new-client-tab"
              className={activeTab === 'new' ? 'active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === 'new'}
              aria-controls="new-client-panel"
              onClick={() => setActiveTab('new')}
            >
              <UserPlus size={17} />
              Cliente nuevo
            </button>
          </div>

          <div className="opening-scroll">
            {activeTab === 'existing' ? (
              <section
                id="existing-client-panel"
                className="opening-client-panel"
                role="tabpanel"
                aria-labelledby="existing-client-tab"
              >
                <label className="directory-search">
                  <Search size={17} aria-hidden="true" />
                  <span className="sr-only">Buscar cliente</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Buscar por nombre, identificación, correo o teléfono"
                    autoFocus
                  />
                </label>

                <div
                  className="client-directory-list"
                  role="radiogroup"
                  aria-label="Seleccionar cliente"
                >
                  {filteredClients.length > 0 ? (
                    filteredClients.map((cliente) => {
                      const isSelected = selectedClientId === cliente.id;
                      return (
                        <button
                          key={cliente.id}
                          className={`client-directory-option ${isSelected ? 'selected' : ''}`}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => setSelectedClientId(cliente.id)}
                        >
                          <span className="client-option-check" aria-hidden="true">
                            {isSelected && <CircleCheck size={18} />}
                          </span>
                          <span className="client-option-identity">
                            <strong>{cliente.nombre}</strong>
                            <span>
                              {cliente.tipo_documento} · {cliente.numero_documento}
                            </span>
                          </span>
                          <span className="client-option-contact">
                            <span>{cliente.email}</span>
                            <span>{cliente.telefono || 'Sin teléfono'}</span>
                            <span className="client-portal-state">
                              {cliente.portal_habilitado
                                ? 'Portal habilitado'
                                : 'Sin acceso al portal'}
                            </span>
                          </span>
                          <span className="client-option-meta">
                            <strong>
                              {cliente.asuntos_count === 1
                                ? '1 asunto'
                                : `${cliente.asuntos_count} asuntos`}
                            </strong>
                            <span>
                              {[cliente.ciudad, cliente.departamento]
                                .filter(Boolean)
                                .join(', ') || 'Ubicación sin registrar'}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div className="opening-empty">
                      <strong>No encontramos coincidencias</strong>
                      <span className="muted small">
                        Revisa la búsqueda o registra un cliente nuevo.
                      </span>
                    </div>
                  )}
                </div>
              </section>
            ) : (
              <section
                id="new-client-panel"
                className="opening-new-client"
                role="tabpanel"
                aria-labelledby="new-client-tab"
              >
                <div className="opening-section-heading">
                  <div>
                    <span className="page-eyebrow">Perfil permanente</span>
                    <h4>Datos del cliente</h4>
                  </div>
                  <span className="muted small">* Campos obligatorios</span>
                </div>

                <div className="opening-fields-grid">
                  <div className="field">
                    <label htmlFor="client-person-type">Tipo de persona *</label>
                    <select
                      id="client-person-type"
                      value={newClient.tipo_persona}
                      onChange={(event) => {
                        const tipo = event.target.value as NewClientForm['tipo_persona'];
                        setNewClient({
                          ...newClient,
                          tipo_persona: tipo,
                          tipo_documento: tipo === 'juridica' ? 'NIT' : 'CC',
                        });
                      }}
                    >
                      <option value="natural">Persona natural</option>
                      <option value="juridica">Persona jurídica</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="client-document-type">Tipo de identificación *</label>
                    <select
                      id="client-document-type"
                      value={newClient.tipo_documento}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        tipo_documento: event.target.value as NewClientForm['tipo_documento'],
                      })}
                    >
                      <option value="CC">Cédula de ciudadanía</option>
                      <option value="CE">Cédula de extranjería</option>
                      <option value="NIT">NIT</option>
                      <option value="PASAPORTE">Pasaporte</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="client-document">Número de identificación *</label>
                    <input
                      id="client-document"
                      required
                      value={newClient.numero_documento}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        numero_documento: event.target.value,
                      })}
                      placeholder="1.094.852.140"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-document-date">Fecha de expedición</label>
                    <input
                      id="client-document-date"
                      type="date"
                      value={newClient.fecha_expedicion}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        fecha_expedicion: event.target.value,
                      })}
                    />
                  </div>
                  <div className="field opening-field-wide">
                    <label htmlFor="client-name">Nombre legal o razón social *</label>
                    <input
                      id="client-name"
                      required
                      value={newClient.nombre}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        nombre: event.target.value,
                      })}
                      placeholder="Nombre completo según identificación"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-email">Correo electrónico *</label>
                    <input
                      id="client-email"
                      type="email"
                      required
                      value={newClient.email}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        email: event.target.value,
                      })}
                      placeholder="cliente@ejemplo.com"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-phone">Teléfono o WhatsApp</label>
                    <input
                      id="client-phone"
                      type="tel"
                      value={newClient.telefono}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        telefono: event.target.value,
                      })}
                      placeholder="300 123 4567"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-preferred-channel">Canal preferido</label>
                    <select
                      id="client-preferred-channel"
                      value={newClient.canal_preferido}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        canal_preferido: event.target.value as NewClientForm['canal_preferido'],
                      })}
                    >
                      <option value="email">Correo electrónico</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="telefono">Llamada telefónica</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="client-city">Ciudad</label>
                    <input
                      id="client-city"
                      value={newClient.ciudad}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        ciudad: event.target.value,
                      })}
                      placeholder="Bucaramanga"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="client-department">Departamento</label>
                    <input
                      id="client-department"
                      value={newClient.departamento}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        departamento: event.target.value,
                      })}
                      placeholder="Santander"
                    />
                  </div>
                  <div className="field opening-field-wide">
                    <label htmlFor="client-address">Dirección de residencia o sede</label>
                    <input
                      id="client-address"
                      value={newClient.direccion}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        direccion: event.target.value,
                      })}
                      placeholder="Calle, carrera, número y complemento"
                    />
                  </div>
                  <div className="field opening-field-wide">
                    <label htmlFor="client-notification-address">
                      Dirección física para notificaciones
                    </label>
                    <input
                      id="client-notification-address"
                      value={newClient.direccion_notificacion}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        direccion_notificacion: event.target.value,
                      })}
                      placeholder="Si es diferente de la dirección principal"
                    />
                  </div>
                  <div className="field opening-field-wide">
                    <label htmlFor="client-notes">Observaciones internas</label>
                    <textarea
                      id="client-notes"
                      rows={3}
                      value={newClient.observaciones}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        observaciones: event.target.value,
                      })}
                      placeholder="Preferencias de contacto o información operativa relevante"
                    />
                  </div>
                  <label className="opening-portal-toggle opening-field-wide">
                    <input
                      type="checkbox"
                      checked={newClient.habilitar_portal}
                      onChange={(event) => setNewClient({
                        ...newClient,
                        habilitar_portal: event.target.checked,
                      })}
                    />
                    <span>
                      <strong>Habilitar acceso al portal</strong>
                      <span>
                        Primer ingreso con el código temporal 12345.
                      </span>
                    </span>
                  </label>
                </div>
              </section>
            )}
          </div>

          <section className="opening-assignment" aria-labelledby="case-assignment-title">
            <div className="opening-section-heading">
              <div>
                <span className="page-eyebrow">Nuevo asunto</span>
                <h4 id="case-assignment-title">Asignación inicial</h4>
              </div>
              <span className="muted small">
                Paso 1 · Recepción y evaluación inicial
              </span>
            </div>
            <div className="opening-assignment-grid">
              <div className="field">
                <label htmlFor="case-responsible">Abogado responsable *</label>
                <select
                  id="case-responsible"
                  required
                  value={responsableId}
                  onChange={(event) => setResponsableId(event.target.value)}
                >
                  <option value="">Seleccionar responsable</option>
                  {responsables.map((responsable) => (
                    <option key={responsable.id} value={responsable.id}>
                      {responsable.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="case-opening-date">Fecha de apertura *</label>
                <input
                  id="case-opening-date"
                  type="date"
                  required
                  value={openingDate}
                  onChange={(event) => setOpeningDate(event.target.value)}
                />
              </div>
            </div>
            {activeTab === 'existing' && selectedClient && (
              <div className="opening-selection-summary">
                <CircleCheck size={18} aria-hidden="true" />
                <span>
                  El asunto quedará vinculado a <strong>{selectedClient.nombre}</strong>.
                </span>
              </div>
            )}
          </section>

          {errorMessage && (
            <div className="form-error opening-error" role="alert">
              {errorMessage}
            </div>
          )}

          <footer className="modal-footer opening-modal-footer">
            <span className="muted small">
              El cliente permanecerá en el directorio aunque el asunto finalice.
            </span>
            <div className="row">
              <button
                className="secondary-button"
                type="button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={
                  isLoading
                  || (activeTab === 'existing'
                    ? !canSubmitExisting
                    : !canSubmitNew)
                }
              >
                {isLoading ? 'Abriendo asunto…' : 'Abrir asunto'}
                <FolderPlus size={17} />
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
