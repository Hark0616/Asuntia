import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileText, 
  Upload, 
  ExternalLink, 
  Trash2, 
  Eye, 
  EyeOff, 
  Lock,
  Plus,
  FileCode
} from 'lucide-react';
import { 
  fetchDocumentosAsunto, 
  uploadDocumentoAPI, 
  toggleVisibilidadDocumentoAPI, 
  deleteDocumentoAPI, 
  DocumentoAPI 
} from '../api/documentos';
import { Tooltip } from '@/components/ui/Tooltip';

interface DocumentosTabProps {
  asuntoId: string;
  isReadOnly?: boolean;
}

const TIPO_LABELS: Record<string, string> = {
  anexo: '01_Anexos del cliente',
  escrito_solicitud: '02_Solicitud / Radicado',
  auto_admisorio: '03_Auto admisorio',
  acta_audiencia: '03_Acta de audiencia',
  acta_acuerdo: '03_Acta de acuerdo',
  poder: '01_Poder otorgado',
  comunicacion_juzgado: '04_Comunicación del juzgado',
  otro: 'Documento general'
};

const SUBCARPETAS = [
  { id: 'anexo', label: '📁 01_Anexos (Insumos cliente)' },
  { id: 'solicitud', label: '📁 02_Solicitud (Escrito borrador/final)' },
  { id: 'audiencia', label: '📁 03_Audiencias (Autos y actas)' },
  { id: 'liquidacion', label: '📁 04_Liquidacion (Etapa judicial)' }
];

export function DocumentosTab({ asuntoId, isReadOnly = false }: DocumentosTabProps) {
  const queryClient = useQueryClient();
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [nombreFuncional, setNombreFuncional] = useState('');
  const [tipoDocumental, setTipoDocumental] = useState('anexo');
  const [compartido, setCompartido] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [previewDocUrl, setPreviewDocUrl] = useState<string | null>(null);

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ['documentos', asuntoId, isReadOnly],
    queryFn: () => fetchDocumentosAsunto(asuntoId, isReadOnly)
  });
  const gruposDocumentales = SUBCARPETAS
    .map((carpeta) => ({
      ...carpeta,
      documentos: documentos.filter((documento) => documento.subcarpeta === carpeta.id),
    }))
    .filter((carpeta) => carpeta.documentos.length > 0);

  const mutacionVisibilidad = useMutation({
    mutationFn: ({ docId, val }: { docId: string; val: boolean }) =>
      toggleVisibilidadDocumentoAPI(docId, val),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', asuntoId] });
    }
  });

  const mutacionBorrado = useMutation({
    mutationFn: (docId: string) => deleteDocumentoAPI(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentos', asuntoId] });
    }
  });

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !nombreFuncional.trim()) return;

    setUploading(true);
    setUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('nombre_funcional', nombreFuncional);
      formData.append('tipo_documental', tipoDocumental);
      formData.append('compartido_con_cliente', String(compartido));

      await uploadDocumentoAPI(asuntoId, formData);
      queryClient.invalidateQueries({ queryKey: ['documentos', asuntoId] });
      queryClient.invalidateQueries({ queryKey: ['asuntos'] });
      
      setNombreFuncional('');
      setSelectedFile(null);
      setShowUploadForm(false);
    } catch {
      setUploadError('No fue posible cargar el documento.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="panel" style={{ marginTop: '16px' }}>
      <div className="row between" style={{ marginBottom: '16px' }}>
        <div>
          <h3>
            Expediente Documental ({documentos.length})
            <Tooltip content="Documentos y soportes alojados en Google Drive o en el servidor de la firma." />
          </h3>
        </div>

        {!isReadOnly && (
          <button 
            className="secondary-button" 
            type="button" 
            onClick={() => setShowUploadForm(!showUploadForm)}
          >
            {showUploadForm ? 'Cancelar' : <><Plus size={16} /> Subir documento</>}
          </button>
        )}
      </div>

      {!isReadOnly && showUploadForm && (
        <form onSubmit={handleUploadSubmit} className="panel" style={{ backgroundColor: 'var(--panel-subtle)', marginBottom: '16px' }}>
          {uploadError && (
            <div className="badge danger" style={{ marginBottom: '12px' }}>
              {uploadError}
            </div>
          )}
          <div className="form-grid">
            <div className="field full">
              <label htmlFor="doc-nombre">Nombre funcional del documento</label>
              <input
                id="doc-nombre"
                type="text"
                required
                value={nombreFuncional}
                onChange={(e) => setNombreFuncional(e.target.value)}
                placeholder="Ej. Auto Admisorio de Conciliación"
              />
            </div>

            <div className="field">
              <label htmlFor="doc-tipo">
                Tipo documental
                <Tooltip content="El tipo determina automáticamente la carpeta del expediente." />
              </label>
              <select 
                id="doc-tipo"
                value={tipoDocumental}
                onChange={(e) => setTipoDocumental(e.target.value)}
              >
                {Object.entries(TIPO_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="doc-file">Archivo (PDF / Imagen / Doc)</label>
              <input
                id="doc-file"
                type="file"
                required
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSelectedFile(f);
                    if (!nombreFuncional) setNombreFuncional(f.name.replace(/\.[^/.]+$/, ''));
                  }
                }}
              />
            </div>

            <div className="field full row" style={{ gap: '8px' }}>
              <input
                id="doc-shared"
                type="checkbox"
                checked={compartido}
                onChange={(e) => setCompartido(e.target.checked)}
              />
              <label htmlFor="doc-shared" style={{ cursor: 'pointer', margin: 0 }}>
                Compartir con el cliente en su portal
              </label>
            </div>

            <div className="field full">
              <button className="primary-button" type="submit" disabled={uploading}>
                <Upload size={16} />
                {uploading ? 'Transmitiendo a la nube...' : 'Guardar en Expediente Nube'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Modal / Embed de Previsualización Proxy */}
      {previewDocUrl && (
        <div className="panel" style={{ marginBottom: '16px', padding: '16px', border: '1px solid var(--brand)' }}>
          <div className="row between" style={{ marginBottom: '8px' }}>
            <strong>Previsualización Segura de PDF</strong>
            <button className="secondary-button" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => setPreviewDocUrl(null)}>Cerrar Previsualización</button>
          </div>
          <iframe src={previewDocUrl} style={{ width: '100%', height: '360px', borderRadius: '6px', border: 'none' }} title="Preview PDF" />
        </div>
      )}

      {isLoading ? (
        <div className="muted small" style={{ padding: '16px', textAlign: 'center' }}>Cargando expediente documental...</div>
      ) : documentos.length > 0 ? (
        <div className="document-groups">
          {gruposDocumentales.map((grupo) => (
            <section className="document-group" key={grupo.id}>
              <h4>{grupo.label.replace('📁 ', '')}</h4>
              <div className="stack">
                {grupo.documentos.map((doc: DocumentoAPI) => (
                  <div key={doc.id} className="document-row">
              <div className="row between wrap">
                <div className="row" style={{ gap: '12px' }}>
                  <FileText size={20} style={{ color: 'var(--brand)' }} />
                  <div>
                    <strong>{doc.nombre_funcional}</strong>
                    <div className="row" style={{ gap: '8px', marginTop: '4px' }}>
                      <span className="badge neutral">{TIPO_LABELS[doc.tipo_documental] || doc.tipo_documental}</span>
                      <span className="muted small" style={{ textTransform: 'uppercase' }}>{doc.provider || 'Google Drive'}</span>
                      {doc.compartido_con_cliente ? (
                        <span className="badge mint" style={{ gap: '4px' }}>
                          <Eye size={12} /> Visible para el cliente
                        </span>
                      ) : (
                        <span className="badge warning" style={{ gap: '4px' }}>
                          <Lock size={12} /> Solo firma
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: '8px' }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ height: '36px', fontSize: '13px' }}
                    onClick={() => setPreviewDocUrl(`http://localhost:8000/api/v1/documentos/${doc.id}/preview`)}
                  >
                    <FileCode size={14} /> Previsualizar PDF
                  </button>

                  <a
                    href={doc.web_view_url}
                    target="_blank"
                    rel="noreferrer"
                    className="secondary-button"
                    style={{ height: '36px', fontSize: '13px', textDecoration: 'none' }}
                  >
                    <ExternalLink size={14} /> Nube
                  </a>

                  {!isReadOnly && (
                    <>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => mutacionVisibilidad.mutate({ docId: doc.id, val: !doc.compartido_con_cliente })}
                        title={doc.compartido_con_cliente ? 'Ocultar al cliente' : 'Compartir con cliente'}
                        style={{ height: '36px', padding: '0 10px' }}
                      >
                        {doc.compartido_con_cliente ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>

                      <button
                        className="icon-button"
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Eliminar ${doc.nombre_funcional}?`)) {
                            mutacionBorrado.mutate(doc.id);
                          }
                        }}
                        title="Eliminar documento"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="muted small" style={{ padding: '24px', textAlign: 'center' }}>
          Sin documentos cargados en el expediente.
        </div>
      )}
    </div>
  );
}
