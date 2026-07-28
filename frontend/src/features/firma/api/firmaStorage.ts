import { apiClient } from '@/lib/axios';

export interface FirmaStorageConfig {
  id: string;
  firma_id: string;
  provider: 'local' | 'google_drive';
  auth_type: 'local' | 'oauth2';
  root_folder_id?: string;
  root_folder_name?: string;
  is_active: boolean;
  last_verified_at?: string;
}

export async function getGoogleOAuthAuthUrl(): Promise<string> {
  const res = await apiClient.get<{ authorization_url: string }>(
    '/storage/auth-url',
    { params: { provider: 'google_drive' } },
  );
  return res.data.authorization_url;
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
