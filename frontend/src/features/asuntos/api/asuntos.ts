import { apiClient } from '@/lib/axios';

export interface AsuntoAPI {
  id: string;
  radicado: string;
  etapa_actual: string;
  siguiente_paso: string;
  cliente_id: string;
  abogado_id?: string;
  estado?: {
    id: string;
    nombre: string;
    color_tipo: string;
  };
  novedades: Array<{
    id: string;
    asunto_id: string;
    titulo: string;
    descripcion: string;
    publicado_al_cliente: boolean;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
}

export const fetchAsuntos = async (): Promise<AsuntoAPI[]> => {
  const response = await apiClient.get<AsuntoAPI[]>('/asuntos');
  return response.data;
};

export const crearNovedadAPI = async (asuntoId: string, payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean }) => {
  const response = await apiClient.post(`/novedades/asunto/${asuntoId}`, payload);
  return response.data;
};

export const actualizarEstadoAPI = async (asuntoId: string, payload: { etapa_actual?: string; siguiente_paso?: string }) => {
  const response = await apiClient.patch(`/asuntos/${asuntoId}/estado`, payload);
  return response.data;
};
