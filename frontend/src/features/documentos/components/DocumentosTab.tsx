import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ExternalLink, Eye, EyeOff, FileText, Lock, Plus, RefreshCw, Trash2, Upload } from 'lucide-react';

import { apiClient } from '@/lib/axios';
import { Tooltip } from '@/components/ui/Tooltip';
import {
  fetchDocumentosAsunto,
  uploadDocumentoAPI,
  toggleVisibilidadDocumentoAPI,
  deleteDocumentoAPI,
} from '../api/documentos';
import '../documentos.css';

interface DocumentosTabProps {
  asuntoId: string;
  isReadOnly?: boolean;
  canManagePublication?: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  anexo: 'Anexo del cliente',
  escrito_solicitud: 'Solicitud',
  auto_admisorio: 'Auto admisorio',
  acta_audiencia: 'Acta de audiencia',
  acta_acuerdo: 'Acta de acuerdo',
  poder: 'Poder otorgado',
  comunicacion_juzgado: 'Comunicación del juzgado',
  otro: 'Documento general',
};

const SUBCARPETAS = [
  { id: 'anexo', label: '01_Anexos (Insumos cliente)', publicLabel: 'Anexos' },
  { id: 'solicitud', label: '02_Solicitud (Escrito borrador/final)', publicLabel: 'Solicitudes' },
  { id: 'audiencia', label: '03_Audiencias (Autos y actas)', publicLabel: 'Audiencias' },
  { id: 'liquidacion', label: '04_Liquidacion (Etapa judicial)', publicLabel: 'Liquidación' },
];

const INLINE_MIME_TYPES = new Set([
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain',
]);

export function DocumentosTab({
  asuntoId,
  isReadOnly = false,
  canManagePublication = false,
}: DocumentosTabProps) {
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [nombreFuncional, setNombreFuncional] = useState('');
  const [tipoDocumental, setTipoDocumental] = useState('anexo');
  const [compartido, setCompartido] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<{ url: string; nombre: string } | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const canPublish = !isReadOnly && canManagePublication;

  useEffect(() => {
    if (previewDoc) previewRef.current?.focus();
  }, [previewDoc]);

  const query = useQuery({
    queryKey: ['documentos', asuntoId, isReadOnly],
    queryFn: () => fetchDocumentosAsunto(asuntoId, isReadOnly),
  });
  const documentos = query.data || [];
  const normalizarBusqueda = (value: string) => value.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO');
  const terminos = normalizarBusqueda(busqueda).trim().split(/\s+/).filter(Boolean);
  const documentosVisibles = documentos.filter((documento) => {
    const contenido = normalizarBusqueda(`${documento.nombre_funcional} ${TIPO_LABELS[documento.tipo_documental] || documento.tipo_documental}`);
    return terminos.every((termino) => contenido.includes(termino));
  });
  const gruposDocumentales = SUBCARPETAS
    .map((carpeta) => ({
      ...carpeta,
      documentos: documentosVisibles.filter((documento) => documento.subcarpeta === carpeta.id),
    }))
    .filter((carpeta) => carpeta.documentos.length > 0);
  const sinClasificar = documentosVisibles.filter((documento) => (
    !SUBCARPETAS.some((carpeta) => carpeta.id === documento.subcarpeta)
  ));
  if (sinClasificar.length) {
    gruposDocumentales.push({
      id: 'otros', label: 'Otros documentos', publicLabel: 'Otros documentos',
      documentos: sinClasificar,
    });
  }

  const refreshExpediente = () => {
    queryClient.invalidateQueries({ queryKey: ['documentos', asuntoId] });
    queryClient.invalidateQueries({ queryKey: ['asuntos'] });
    queryClient.invalidateQueries({ queryKey: ['portal', 'asuntos'] });
  };
  const mutacionVisibilidad = useMutation({
    mutationFn: ({ docId, val }: { docId: string; val: boolean }) => (
      toggleVisibilidadDocumentoAPI(docId, val)
    ),
    onSuccess: refreshExpediente,
  });
  const mutacionBorrado = useMutation({
    mutationFn: deleteDocumentoAPI,
    onSuccess: refreshExpediente,
  });
  const busy = uploading || mutacionVisibilidad.isPending || mutacionBorrado.isPending;

  const handleUploadSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile || !nombreFuncional.trim() || busy) return;
    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('nombre_funcional', nombreFuncional.trim());
      formData.append('tipo_documental', tipoDocumental);
      formData.append('compartido_con_cliente', String(canPublish && compartido));
      await uploadDocumentoAPI(asuntoId, formData);
      refreshExpediente();
      setNombreFuncional('');
      setSelectedFile(null);
      setCompartido(false);
      setShowUploadForm(false);
    } catch {
      setUploadError('No fue posible guardar el documento. Inténtalo de nuevo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="document-section" aria-labelledby={`documentos-title-${asuntoId}`}>
      <div className="document-toolbar">
        <h3 id={`documentos-title-${asuntoId}`}>
          {isReadOnly ? 'Documentos compartidos' : 'Documentos del expediente'}
          {query.data && <span className="muted small"> ({documentos.length})</span>}
          <Tooltip content={isReadOnly
            ? 'Solo aparecen documentos que la firma ha autorizado para tu consulta.'
            : 'El tipo documental determina la carpeta del expediente.'}
          />
        </h3>
        {!isReadOnly && (
          <button
            className="secondary-button"
            type="button"
            disabled={uploading}
            onClick={() => {
              setUploadError('');
              setShowUploadForm(!showUploadForm);
            }}
          >
            {showUploadForm ? 'Cancelar' : <><Plus size={16} aria-hidden="true" /> Subir documento</>}
          </button>
        )}
      </div>

      {documentos.length > 0 && (
        <div className="document-search" role="search" aria-label="Documentos del asunto">
          <div className="field">
            <label htmlFor={`document-search-${asuntoId}`}>Buscar documentos</label>
            <input id={`document-search-${asuntoId}`} type="search" value={busqueda}
              placeholder="Nombre o tipo documental"
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>
          {terminos.length > 0 && (
            <span className="muted small" role="status">
              {documentosVisibles.length} de {documentos.length} documentos
            </span>
          )}
        </div>
      )}

      {!isReadOnly && showUploadForm && (
        <form onSubmit={handleUploadSubmit} className="document-upload">
          {uploadError && <p className="document-error" role="alert">{uploadError}</p>}
          <fieldset disabled={busy} className="document-fieldset">
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="doc-nombre">Nombre del documento</label>
                <input id="doc-nombre" required value={nombreFuncional}
                  onChange={(event) => setNombreFuncional(event.target.value)}
                  placeholder="Ej. Poder del cliente"
                />
              </div>
              <div className="field">
                <label htmlFor="doc-tipo">Tipo documental</label>
                <select id="doc-tipo" value={tipoDocumental}
                  onChange={(event) => setTipoDocumental(event.target.value)}>
                  {Object.entries(TIPO_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="doc-file">Archivo</label>
                <input id="doc-file" type="file" required
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      if (!nombreFuncional) setNombreFuncional(file.name.replace(/\.[^/.]+$/, ''));
                    }
                  }}
                />
              </div>
              {canPublish && (
                <div className="field full row">
                  <input id="doc-shared" type="checkbox" checked={compartido}
                    onChange={(event) => setCompartido(event.target.checked)}
                  />
                  <label htmlFor="doc-shared">Compartir con el cliente</label>
                </div>
              )}
              <div className="field full">
                <button className="primary-button" type="submit">
                  <Upload size={16} aria-hidden="true" />
                  {uploading ? 'Guardando…' : 'Guardar documento'}
                </button>
              </div>
            </div>
          </fieldset>
        </form>
      )}

      {(mutacionVisibilidad.isError || mutacionBorrado.isError) && (
        <p className="document-error" role="alert">
          No fue posible actualizar el documento. Inténtalo de nuevo.
        </p>
      )}

      {/* Previsualización del archivo local mediante la API autenticada. */}
      {previewDoc && (
        <div className="document-preview" ref={previewRef} tabIndex={-1}
          role="region" aria-label={`Previsualización de ${previewDoc.nombre}`}>
          <div className="document-toolbar">
            <strong>{previewDoc.nombre}</strong>
            <a href={previewDoc.url} target="_blank" rel="noreferrer" className="secondary-button">
              <ExternalLink size={14} aria-hidden="true" /> Abrir documento
            </a>
            <button className="secondary-button" type="button" onClick={() => {
              setPreviewDoc(null);
              previewTriggerRef.current?.focus();
            }}>
              Cerrar previsualización
            </button>
          </div>
          <iframe src={previewDoc.url} title={`Previsualización de ${previewDoc.nombre}`} />
        </div>
      )}

      {query.isLoading ? (
        <div className="document-loading" role="status" aria-label="Cargando documentos">
          <span /><span /><span />
        </div>
      ) : query.isError && !query.data ? (
        <div className="document-query-error" role="alert">
          <AlertCircle size={20} aria-hidden="true" />
          <span>No pudimos cargar los documentos.</span>
          <button className="secondary-button" type="button"
            disabled={query.isFetching} onClick={() => query.refetch()}>
            <RefreshCw size={16} aria-hidden="true" />
            {query.isFetching ? 'Consultando…' : 'Reintentar'}
          </button>
        </div>
      ) : (
        <>
          {query.isError && (
            <div className="work-stale-notice document-query-error" role="status">
              <span>Mostrando los últimos documentos disponibles.</span>
              <button className="secondary-button" type="button"
                disabled={query.isFetching} onClick={() => query.refetch()}>
                <RefreshCw size={16} aria-hidden="true" />
                {query.isFetching ? 'Consultando…' : 'Reintentar'}
              </button>
            </div>
          )}
          {documentosVisibles.length > 0 ? (
            <div className="document-groups">
              {gruposDocumentales.map((grupo) => (
                <section className="document-group" key={grupo.id}>
                  <h4>{isReadOnly ? grupo.publicLabel : grupo.label}</h4>
                  {grupo.documentos.map((doc) => (
                    <article key={doc.id} className="document-file">
                      <FileText size={20} aria-hidden="true" />
                      <div className="document-file-body">
                        <strong>{doc.nombre_funcional}</strong>
                        <div className="document-file-meta">
                          <span className="muted small">{TIPO_LABELS[doc.tipo_documental] || doc.tipo_documental}</span>
                          {!isReadOnly && (
                            <span className={`badge ${doc.compartido_con_cliente ? 'mint' : 'neutral'}`}>
                              {doc.compartido_con_cliente ? <Eye size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                              {doc.compartido_con_cliente ? 'Compartido' : 'Solo firma'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="document-actions">
                        {doc.provider === 'local' && doc.mime_type
                          && INLINE_MIME_TYPES.has(doc.mime_type.toLowerCase()) ? (
                          <button className="secondary-button" type="button"
                            onClick={(event) => {
                              previewTriggerRef.current = event.currentTarget;
                              setPreviewDoc({
                                url: apiClient.getUri({ url: `/documentos/${doc.id}/preview` }),
                                nombre: doc.nombre_funcional,
                              });
                            }}>
                            Ver documento
                          </button>
                        ) : doc.provider === 'local' ? (
                          <a href={apiClient.getUri({ url: `/documentos/${doc.id}/preview` })}
                            className="secondary-button">
                            Descargar documento
                          </a>
                        ) : (
                          <a href={doc.web_view_url} target="_blank" rel="noreferrer" className="secondary-button">
                            <ExternalLink size={14} aria-hidden="true" /> Abrir documento
                          </a>
                        )}
                        {canPublish && (
                          <>
                            <button className="secondary-button" type="button" disabled={busy}
                              aria-label={`${doc.compartido_con_cliente ? 'Ocultar' : 'Compartir'} ${doc.nombre_funcional} ${doc.compartido_con_cliente ? 'al' : 'con el'} cliente`}
                              onClick={() => mutacionVisibilidad.mutate({ docId: doc.id, val: !doc.compartido_con_cliente })}>
                              {doc.compartido_con_cliente ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                            </button>
                            <button className="icon-button" type="button" disabled={busy}
                              aria-label={`Archivar ${doc.nombre_funcional}`}
                              onClick={() => {
                                if (confirm(`¿Archivar ${doc.nombre_funcional}?`)) {
                                  setPreviewDoc(null);
                                  mutacionBorrado.mutate(doc.id);
                                }
                              }}>
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <p className="document-empty">
              {documentos.length > 0
                ? 'Sin resultados para esta búsqueda.'
                : isReadOnly ? 'Aún no hay documentos compartidos.' : 'Sin documentos en el expediente.'}
              {documentos.length > 0 && (
                <button className="secondary-button" type="button" onClick={() => setBusqueda('')}>
                  Limpiar búsqueda
                </button>
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
