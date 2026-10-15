import { isAxiosError } from 'axios';
import { apiClient } from '@/lib/axios';
import type { AltaEquipo, CambioEquipo, InvitacionEquipo, MiembroEquipo } from '@/types/equipo';

export const consultarEquipo = async (): Promise<MiembroEquipo[]> =>
  (await apiClient.get('/equipo/gestion')).data;

export const invitarMiembro = async (data: AltaEquipo): Promise<InvitacionEquipo> =>
  (await apiClient.post('/equipo/invitaciones', data)).data;

export const renovarInvitacion = async ({ id, expected_updated_at }: CambioEquipo): Promise<InvitacionEquipo> =>
  (await apiClient.post(`/equipo/${id}/invitacion`, { expected_updated_at })).data;

export const cambiarRol = async ({ id, ...data }: CambioEquipo): Promise<MiembroEquipo> =>
  (await apiClient.patch(`/equipo/${id}/rol`, data)).data;

export const retirarAcceso = async ({ id, ...data }: CambioEquipo): Promise<MiembroEquipo> =>
  (await apiClient.post(`/equipo/${id}/desactivar`, data)).data;

export const activarMiembro = async (data: {
  firma_slug: string; invitacion_id: string; token: string; password: string;
}): Promise<void> => { await apiClient.post('/auth/equipo/activar', data); };

export function errorEquipo(error: unknown, fallback: string): string {
  const detail = isAxiosError(error) ? error.response?.data?.detail : null;
  return typeof detail === 'string' ? detail : fallback;
}

export function enlaceInvitacion(invitation: InvitacionEquipo): string {
  const fragment = new URLSearchParams({ invitacion: invitation.invitacion_id, token: invitation.token });
  return `${window.location.origin}/activar-equipo?firma=${encodeURIComponent(invitation.firma_slug)}#${fragment}`;
}
