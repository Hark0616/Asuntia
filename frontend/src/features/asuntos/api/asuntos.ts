import { apiClient } from '@/lib/axios';

export interface EstadoProcesalAPI {
  id: string;
  nombre: string;
  descripcion?: string;
  color_tipo: string;
}

export interface ClienteAPI {
  id: string;
  tipo_persona: 'natural' | 'juridica';
  tipo_documento: 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'OTRO';
  numero_documento: string;
  nombre: string;
  cedula: string;
  email: string;
  telefono?: string;
  fecha_expedicion?: string;
  direccion?: string;
  direccion_notificacion?: string;
  ciudad?: string;
  departamento?: string;
  canal_preferido: 'email' | 'telefono' | 'whatsapp';
  observaciones?: string;
  portal_user_id?: string;
  responsable_id?: string;
  portal_habilitado: boolean;
  asuntos_count: number;
  rol: string;
  created_at: string;
}

export interface ClienteCreatePayload {
  tipo_persona: 'natural' | 'juridica';
  tipo_documento: 'CC' | 'CE' | 'NIT' | 'PASAPORTE' | 'OTRO';
  numero_documento: string;
  nombre: string;
  email: string;
  telefono?: string;
  fecha_expedicion?: string;
  direccion?: string;
  direccion_notificacion?: string;
  ciudad?: string;
  departamento?: string;
  canal_preferido: 'email' | 'telefono' | 'whatsapp';
  observaciones?: string;
  habilitar_portal: boolean;
}

export interface ResponsableAPI {
  id: string;
  nombre: string;
  rol: 'administrador' | 'abogado';
}

export interface AperturaAsuntoPayload {
  cliente_id?: string;
  cliente_nuevo?: ClienteCreatePayload;
  abogado_id: string;
  fecha_apertura: string;
}

export interface PasoCampoAPI {
  clave: string;
  etiqueta: string;
  tipo: 'text' | 'textarea' | 'date' | 'datetime' | 'url' | 'select' | 'boolean';
  requerido: boolean;
  opciones: Array<{ valor: string; etiqueta: string }>;
}

export interface AsuntoPasoAPI {
  id: string;
  orden: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: 'bloqueado' | 'activo' | 'completado';
  campos: PasoCampoAPI[];
  datos: Record<string, unknown>;
  completed_at?: string | null;
  completed_by_id?: string | null;
}

export interface AsuntoAPI {
  id: string;
  radicado: string;
  fecha_apertura: string;
  etapa_actual: string;
  siguiente_paso: string;
  ruta_codigo: string;
  paso_actual: number;
  flujo_estado: 'activo' | 'completado';
  cliente_id: string;
  abogado_id?: string;
  estado?: EstadoProcesalAPI;
  novedades: Array<{
    id: string;
    asunto_id: string;
    asunto_paso_id?: string;
    documento_id?: string;
    tipo: 'nota' | 'paso_completado' | 'documento_incorporado';
    titulo: string;
    descripcion: string;
    publicado_al_cliente: boolean;
    created_at: string;
  }>;
  pasos: AsuntoPasoAPI[];
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

export const fetchResponsablesAPI = async (): Promise<ResponsableAPI[]> => {
  const response = await apiClient.get<ResponsableAPI[]>(
    '/equipo/responsables',
  );
  return response.data;
};

export const crearClienteAPI = async (payload: ClienteCreatePayload) => {
  const response = await apiClient.post<ClienteAPI>('/clientes', payload);
  return response.data;
};

export const crearAsuntoAPI = async (payload: { radicado?: string; cliente_id: string; abogado_id?: string; estado_id?: string; fecha_apertura?: string }) => {
  const response = await apiClient.post<AsuntoAPI>('/asuntos', payload);
  return response.data;
};

export const abrirAsuntoAPI = async (payload: AperturaAsuntoPayload) => {
  const response = await apiClient.post<AsuntoAPI>('/asuntos/apertura', payload);
  return response.data;
};

export const avanzarPasoAPI = async (
  asuntoId: string,
  payload: { paso_codigo: string; datos: Record<string, unknown> },
) => {
  const response = await apiClient.post<AsuntoAPI>(`/asuntos/${asuntoId}/flujo/avanzar`, payload);
  return response.data;
};

export const crearNovedadAPI = async (asuntoId: string, payload: { titulo: string; descripcion: string; publicado_al_cliente: boolean }) => {
  const response = await apiClient.post(`/novedades/asunto/${asuntoId}`, payload);
  return response.data;
};

export const actualizarEstadoAPI = async (asuntoId: string, payload: { estado_id?: string }) => {
  const response = await apiClient.patch(`/asuntos/${asuntoId}/estado`, payload);
  return response.data;
};

export const asignarResponsableClienteAPI = async (
  clienteId: string,
  responsableId: string,
) => {
  const response = await apiClient.patch<ClienteAPI>(
    `/clientes/${clienteId}/responsable`,
    { responsable_id: responsableId },
  );
  return response.data;
};

export const asignarResponsableAsuntoAPI = async (
  asuntoId: string,
  responsableId: string,
) => {
  const response = await apiClient.patch<AsuntoAPI>(
    `/asuntos/${asuntoId}/responsable`,
    { responsable_id: responsableId },
  );
  return response.data;
};
