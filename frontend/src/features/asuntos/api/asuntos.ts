import { apiClient } from '@/lib/axios';

export interface EstadoProcesalAPI {
  id: string;
  nombre: string;
  color_tipo: string;
}

export interface ClienteAPI {
  id: string;
  nombre: string;
  cedula: string;
  email: string;
  telefono?: string;
  rol: string;
  created_at: string;
}

export interface AsuntoAPI {
  id: string;
  radicado: string;
  etapa_actual: string;
  siguiente_paso: string;
  cliente_id: string;
  abogado_id?: string;
  estado?: EstadoProcesalAPI;
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

export const fetchEstadosAPI = async (): Promise<EstadoProcesalAPI[]> => {
  const response = await apiClient.get<EstadoProcesalAPI[]>('/estados');
  return response.data;
};

export const fetchClientesAPI = async (): Promise<ClienteAPI[]> => {
  const response = await apiClient.get<ClienteAPI[]>('/clientes');
  return response.data;
};

export const crearClienteAPI = async (payload: { nombre: string; cedula: string; email: string; telefono?: string }) => {
  const response = await apiClient.post<ClienteAPI>('/clientes', payload);
  return response.data;
};

export const crearAsuntoAPI = async (payload: { radicado: string; cliente_id: string; estado_id?: string; etapa_actual?: string; siguiente_paso?: string }) => {
  const response = await apiClient.post<AsuntoAPI>('/asuntos', payload);
  return response.data;
};

export const crearNovedadAPI = async (asuntoId: string, payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean }) => {
  const response = await apiClient.post(`/novedades/asunto/${asuntoId}`, payload);
  return response.data;
};

export const actualizarEstadoAPI = async (asuntoId: string, payload: { estado_id?: string; etapa_actual?: string; siguiente_paso?: string }) => {
  const response = await apiClient.patch(`/asuntos/${asuntoId}/estado`, payload);
  return response.data;
};
