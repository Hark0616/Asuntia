import { apiClient } from '@/lib/axios';
import type { User } from '@/types/api';
import type { RestablecerPassword, SolicitudAccesoResponse } from '@/types/auth';


interface AuthResponse {
  user: User;
}

export const loginOficinaAPI = async (
  email: string,
  password: string,
  firmaSlug: string,
): Promise<User> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    firma_slug: firmaSlug.trim().toLowerCase(),
    email,
    password,
  });
  return response.data.user;
};

export const solicitarOTPAPI = async (firmaSlug: string, cedula: string): Promise<SolicitudAccesoResponse> => {
  return (await apiClient.post('/auth/otp/request', { firma_slug: firmaSlug.trim().toLowerCase(), cedula })).data;
};

export const solicitarRecuperacionAPI = async (firmaSlug: string, email: string): Promise<SolicitudAccesoResponse> =>
  (await apiClient.post('/auth/password/request', { firma_slug: firmaSlug.trim().toLowerCase(), email })).data;

export const restablecerPasswordAPI = async (data: RestablecerPassword): Promise<void> => {
  await apiClient.post('/auth/password/confirm', data);
};

export function mensajeAuth(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { detail?: unknown }; headers?: Record<string, string> } } | null)?.response;
  const retry = Number(response?.headers?.['retry-after']);
  if (response?.status === 429 && retry > 0) return `Demasiados intentos. Reintenta en ${Math.ceil(retry / 60)} min.`;
  return typeof response?.data?.detail === 'string' ? response.data.detail : fallback;
}

export const verificarOTPAPI = async (firmaSlug: string, cedula: string, code: string): Promise<User> => {
  const response = await apiClient.post<AuthResponse>('/auth/otp/verify', {
    firma_slug: firmaSlug.trim().toLowerCase(), cedula, code,
  });
  return response.data.user;
};

export const fetchCurrentUserAPI = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me');
  return response.data;
};

export const logoutAPI = async (): Promise<void> => {
  await apiClient.post('/auth/logout');
};
