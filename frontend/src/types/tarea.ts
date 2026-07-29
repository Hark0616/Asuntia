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
