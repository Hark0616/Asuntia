import { apiClient } from '@/lib/axios';
import type { MiTrabajoResponse } from '@/types/tarea';

export type AlcanceTrabajo = 'mio' | 'equipo';

export async function fetchMiTrabajo(
  alcance: AlcanceTrabajo = 'mio',
): Promise<MiTrabajoResponse> {
  const response = await apiClient.get<MiTrabajoResponse>('/tareas/mi-trabajo', {
    params: { alcance },
  });
  return response.data;
}
