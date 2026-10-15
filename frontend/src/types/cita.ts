import type { TareaPersonaResumen } from './tarea';

export interface CitaDatos {
  tipo: 'reunion' | 'audiencia';
  titulo: string;
  inicio: string;
  fin: string;
  zona_horaria: string;
  responsable_id: string;
  participantes_ids: string[];
  lugar: string | null;
  enlace: string | null;
  resumen: string | null;
}
export interface Cita extends Omit<CitaDatos, 'fin'> {
  id: string;
  asunto_id: string;
  fin: string | null;
  responsable: TareaPersonaResumen;
  estado: 'programada' | 'cancelada';
  motivo_cancelacion: string | null;
  created_at: string;
  updated_at: string;
  created_by_id: string | null;
}
export interface CitaCambio {
  id: string;
  accion: string;
  datos: Record<string, unknown>;
  created_at: string;
  created_by_id: string | null;
  autor?: TareaPersonaResumen | null;
}
