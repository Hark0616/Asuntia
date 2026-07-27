import { apiClient } from '@/lib/axios';

export interface DocumentoAPI {
  id: string;
  firma_id: string;
  asunto_id: string;
  nombre_funcional: string;
  tipo_documental: string;
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

export const fetchDocumentosAsunto = async (asuntoId: string, soloCompartidos: boolean = false): Promise<DocumentoAPI[]> => {
  const response = await apiClient.get<DocumentoAPI[]>(`/asuntos/${asuntoId}/documentos`, {
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
