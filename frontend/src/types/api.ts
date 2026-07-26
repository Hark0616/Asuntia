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
  rol: 'administrador' | 'abogado' | 'auxiliar' | 'cliente';
  firma_id: string;
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
  updated_at: string;
  firma_id: string;
}

export interface Novedad {
  id: string;
  asunto_id: string;
  titulo: string;
  descripcion: string;
  publicado_al_cliente: boolean;
  created_at: string;
}
