import { apiClient } from '@/lib/axios';
import type { ClienteAPI, ClienteCreatePayload } from '@/features/asuntos/api/asuntos';

type Opcionales = 'telefono' | 'fecha_expedicion' | 'direccion' | 'direccion_notificacion' | 'ciudad' | 'departamento' | 'observaciones';
export type ClienteUpdatePayload = Partial<Omit<ClienteCreatePayload, 'habilitar_portal' | Opcionales>>
  & { [K in Opcionales]?: string | null } & { expected_updated_at: string };
export async function fetchClienteAPI(id: string): Promise<ClienteAPI> {
  return (await apiClient.get<ClienteAPI>(`/clientes/${id}`)).data;
}
export async function actualizarClienteAPI(id: string, payload: ClienteUpdatePayload): Promise<ClienteAPI> {
  return (await apiClient.patch<ClienteAPI>(`/clientes/${id}`, payload)).data;
}
