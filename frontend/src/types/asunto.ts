import type { Novedad } from './api';
import type { AsuntoPasoAPI, EstadoProcesalAPI } from '@/features/asuntos/api/asuntos';

export type RutaCodigo = 'insolvencia_persona_natural:v2';

export interface AsuntoAPI {
  id: string;
  titulo: string;
  codigo_interno: string;
  /** Alias legado de codigo_interno. */
  radicado: string;
  radicado_oficial: string | null;
  fecha_apertura: string;
  etapa_actual: string;
  siguiente_paso: string;
  ruta_codigo: string | null;
  paso_actual: number | null;
  flujo_estado: 'activo' | 'completado' | null;
  cliente_id: string;
  cliente: { id: string; nombre: string; email: string; numero_documento: string; responsable_id?: string };
  abogado_id?: string;
  estado?: EstadoProcesalAPI;
  novedades: Novedad[];
  pasos: AsuntoPasoAPI[];
  created_at: string;
  updated_at: string;
}
