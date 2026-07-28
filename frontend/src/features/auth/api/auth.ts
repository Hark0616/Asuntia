import { apiClient } from '@/lib/axios';
import type { User } from '@/types/api';


interface AuthResponse {
  user: User;
}

export const loginOficinaAPI = async (
  email: string,
  password: string,
): Promise<User> => {
  const response = await apiClient.post<AuthResponse>('/auth/login', {
    firma_slug: 'demo',
    email,
    password,
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
