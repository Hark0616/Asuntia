export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiErrorDetail {
  detail: string;
}

export interface User {
  id: string;
  email: string;
  nombre: string;
  cedula: string;
  rol: 'administrador' | 'abogado' | 'auxiliar' | 'cliente';
  firma_id: string;
}

export interface Cliente {
  id: string;
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
  portal_user_id?: string;
  responsable_id?: string;
  portal_habilitado: boolean;
  asuntos_count: number;
  created_at: string;
}

export interface AuthChallenge {
  id: string;
  user_id: string;
  purpose: string;
  expires_at: string;
  attempts: number;
  consumed_at?: string | null;
}

export interface Asunto {
  id: string;
  radicado: string;
  cliente_id: string;
  cliente_nombre: string;
  abogado_id?: string;
  abogado_nombre?: string;
  estado_actual: string;
  estado_color: string;
  ultima_novedad?: string;
  siguiente_paso?: string;
  ruta_codigo: string;
  paso_actual: number;
  flujo_estado: 'activo' | 'completado';
  pasos: AsuntoPaso[];
  updated_at: string;
  firma_id: string;
}

export interface AsuntoPaso {
  id: string;
  orden: number;
  codigo: string;
  titulo: string;
  descripcion: string;
  estado: 'bloqueado' | 'activo' | 'completado';
  campos: Array<{
    clave: string;
    etiqueta: string;
    tipo: 'text' | 'textarea' | 'date' | 'datetime' | 'url' | 'select' | 'boolean';
    requerido: boolean;
    opciones: Array<{ valor: string; etiqueta: string }>;
  }>;
  datos: Record<string, unknown>;
  completed_at?: string | null;
  completed_by_id?: string | null;
}

export interface Novedad {
  id: string;
  asunto_id: string;
  asunto_paso_id?: string;
  documento_id?: string;
  tipo: 'nota' | 'paso_completado' | 'documento_incorporado';
  titulo: string;
  descripcion: string;
  publicado_al_cliente: boolean;
  created_at: string;
}
