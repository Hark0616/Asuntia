import { apiClient } from '@/lib/axios';

export interface FirmaStorageConfig {
  id: string;
  firma_id: string;
  provider: 'google_drive' | 'onedrive' | 'local' | 'mock';
  auth_type: 'oauth2' | 'service_account' | 'local' | 'none';
  root_folder_id?: string;
  root_folder_name?: string;
  is_active: boolean;
  last_verified_at?: string;
}

export async function fetchFirmaStorageConfig(): Promise<FirmaStorageConfig> {
  const res = await apiClient.get<FirmaStorageConfig>('/firma/storage/config');
  return res.data;
}

export async function updateFirmaStorageConfig(payload: Partial<FirmaStorageConfig>): Promise<FirmaStorageConfig> {
  const res = await apiClient.post<FirmaStorageConfig>('/firma/storage/config', payload);
  return res.data;
}

export async function testStorageConnection(): Promise<{ status: string; provider: string; folder_id: string; web_view_url: string; message: string }> {
  const res = await apiClient.post<{ status: string; provider: string; folder_id: string; web_view_url: string; message: string }>('/firma/storage/config/test');
  return res.data;
}

export async function getOAuthAuthUrl(provider: 'google_drive' | 'onedrive'): Promise<{ provider: string; auth_url: string }> {
  const res = await apiClient.get<{ provider: string; auth_url: string }>(`/storage/auth-url?provider=${provider}`);
  return res.data;
}
