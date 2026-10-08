export type TareaEstado =
  | 'pendiente'
  | 'en_progreso'
  | 'completada'
  | 'cancelada';

export type TareaPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';

export interface TareaPersonaResumen {
  id: string;
  nombre: string;
}

export interface TareaAsuntoResumen {
  id: string;
  radicado: string;
  etapa_actual: string;
  cliente: TareaPersonaResumen;
}

export interface Tarea {
  id: string;
  tipo: string;
  titulo: string;
  instruccion: string;
  consecuencia: string | null;
  estado: TareaEstado;
  prioridad: TareaPrioridad;
  vence_en: string | null;
  asunto: TareaAsuntoResumen;
  responsable: TareaPersonaResumen;
  created_at: string;
  updated_at: string;
}

export interface MiTrabajoResponse {
  items: Tarea[];
  total: number;
}

export interface MiembroEquipo extends TareaPersonaResumen {
  rol: 'administrador' | 'abogado' | 'auxiliar';
}

export interface TareaCreate {
  asunto_id: string;
  titulo: string;
  instruccion: string;
  responsable_id: string;
  prioridad: TareaPrioridad;
  vence_en: string | null;
}

export interface TareaUpdate {
  expected_updated_at: string;
  titulo?: string;
  instruccion?: string;
  responsable_id?: string;
  prioridad?: TareaPrioridad;
  vence_en?: string | null;
  estado?: TareaEstado;
}

export interface AgendaItem {
  id: string;
  origen: 'tarea' | 'audiencia';
  titulo: string;
  fecha: string;
  asunto: TareaAsuntoResumen;
  responsable: TareaPersonaResumen;
}

export interface AgendaResponse {
  items: AgendaItem[];
  total: number;
}
