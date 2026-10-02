import { apiClient } from '@/lib/axios';

/** Proyección de un documento compartido, sin metadatos de almacenamiento internos. */
export interface DocumentoPortalAPI {
  id: string;
  nombre_funcional: string;
  tipo_documental: string;
  subcarpeta: string;
  provider: string;
  web_view_url: string;
  mime_type?: string | null;
  compartido_con_cliente: boolean;
  created_at: string;
}

export interface DocumentoAPI {
  id: string;
  firma_id: string;
  asunto_id: string;
  asunto_paso_id?: string;
  nombre_funcional: string;
  tipo_documental: string;
  subcarpeta: string;
  provider: string;
  external_file_id: string;
  web_view_url: string;
  web_download_url?: string;
  mime_type?: string;
  tamano_bytes?: number;
  compartido_con_cliente: boolean;
  estado_revision: string;
  created_at: string;
  updated_at: string;
}

export const fetchDocumentosAsunto = async (asuntoId: string, soloCompartidos: boolean = false): Promise<Array<DocumentoAPI | DocumentoPortalAPI>> => {
  const response = await apiClient.get<Array<DocumentoAPI | DocumentoPortalAPI>>(`/asuntos/${asuntoId}/documentos`, {
    params: { solo_compartidos: soloCompartidos }
  });
  return response.data;
};

export const uploadDocumentoAPI = async (
  asuntoId: string,
  formData: FormData
): Promise<DocumentoAPI> => {
  const response = await apiClient.post<DocumentoAPI>(`/asuntos/${asuntoId}/documentos/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const toggleVisibilidadDocumentoAPI = async (
  documentoId: string,
  compartido: boolean
): Promise<DocumentoAPI> => {
  const response = await apiClient.patch<DocumentoAPI>(`/documentos/${documentoId}/visibilidad`, null, {
    params: { compartido }
  });
  return response.data;
};

export const deleteDocumentoAPI = async (documentoId: string): Promise<void> => {
  await apiClient.delete(`/documentos/${documentoId}`);
};
