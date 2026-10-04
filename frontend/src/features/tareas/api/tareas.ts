import { apiClient } from '@/lib/axios';
import type { AgendaResponse, MiembroEquipo, MiTrabajoResponse, Tarea, TareaCreate, TareaUpdate } from '@/types/tarea';

export type AlcanceTrabajo = 'mio' | 'equipo';

export async function fetchMiTrabajo(
  alcance: AlcanceTrabajo = 'mio',
): Promise<MiTrabajoResponse> {
  const response = await apiClient.get<MiTrabajoResponse>('/tareas/mi-trabajo', {
    params: { alcance },
  });
  return response.data;
}

export async function fetchTareasAsunto(asuntoId: string): Promise<Tarea[]> {
  return (await apiClient.get<Tarea[]>(`/tareas/asunto/${asuntoId}`)).data;
}

export async function fetchMiembrosEquipo(): Promise<MiembroEquipo[]> {
  return (await apiClient.get<MiembroEquipo[]>('/equipo/miembros')).data;
}

export async function crearTarea(payload: TareaCreate): Promise<Tarea> {
  return (await apiClient.post<Tarea>('/tareas', payload)).data;
}

export async function actualizarTarea(id: string, payload: TareaUpdate): Promise<Tarea> {
  return (await apiClient.patch<Tarea>(`/tareas/${id}`, payload)).data;
}

export async function fetchAgenda(alcance: AlcanceTrabajo, desde: string, hasta: string): Promise<AgendaResponse> {
  return (await apiClient.get<AgendaResponse>('/tareas/agenda', {
    params: { alcance, desde, hasta, limit: 100 },
  })).data;
}
