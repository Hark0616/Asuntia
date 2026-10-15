import { apiClient } from '@/lib/axios';
import type { Cita, CitaCambio, CitaDatos } from '@/types/cita';

export async function fetchCitas(asuntoId: string) {
  return (await apiClient.get<Cita[]>(`/citas/asunto/${asuntoId}`)).data;
}
export async function fetchCita(id: string) {
  return (await apiClient.get<Cita>(`/citas/${id}`)).data;
}
export async function crearCita(asuntoId: string, operacionId: string, datos: CitaDatos) {
  return (await apiClient.post<Cita>('/citas', { ...datos, asunto_id: asuntoId, operacion_id: operacionId })).data;
}
export async function actualizarCita(id: string, version: string, datos: CitaDatos) {
  return (await apiClient.put<Cita>(`/citas/${id}`, { ...datos, expected_updated_at: version })).data;
}
export async function cancelarCita(id: string, version: string, motivo: string) {
  return (await apiClient.post<Cita>(`/citas/${id}/cancelar`, { motivo, expected_updated_at: version })).data;
}
export async function fetchHistorialCita(id: string) {
  return (await apiClient.get<CitaCambio[]>(`/citas/${id}/historial`)).data;
}
