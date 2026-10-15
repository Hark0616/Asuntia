import { apiClient } from '@/lib/axios';
import type { User } from '@/types/api';


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

export const solicitarOTPAPI = async (firmaSlug: string, cedula: string): Promise<void> => {
  await apiClient.post('/auth/otp/request', { firma_slug: firmaSlug.trim().toLowerCase(), cedula });
};

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
