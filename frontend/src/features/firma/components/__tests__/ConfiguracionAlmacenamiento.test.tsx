import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfiguracionAlmacenamiento } from '../ConfiguracionAlmacenamiento';
import { vi, describe, it, expect } from 'vitest';

vi.mock('@/features/firma/api/firmaStorage', () => ({
  fetchFirmaStorageConfig: vi.fn().mockResolvedValue({
    id: 'config-123',
    firma_id: 'firma-001',
    provider: 'google_drive',
    auth_type: 'oauth2',
    is_active: true
  }),
  updateFirmaStorageConfig: vi.fn(),
  testStorageConnection: vi.fn().mockResolvedValue({
    status: 'success',
    provider: 'GoogleDriveStorageService',
    folder_id: 'test-folder',
    web_view_url: 'https://drive.google.com/test',
    message: 'Conexión probada'
  }),
  getOAuthAuthUrl: vi.fn()
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('ConfiguracionAlmacenamiento Component', () => {
  it('debe renderizar las opciones de proveedores de almacenamiento', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ConfiguracionAlmacenamiento />
      </QueryClientProvider>
    );

    expect(await screen.findByText('Almacenamiento de la Firma')).toBeInTheDocument();
    expect(screen.getByText('Google Drive')).toBeInTheDocument();
    expect(screen.getByText('OneDrive / M365')).toBeInTheDocument();
    expect(screen.getByText('Servidor Local')).toBeInTheDocument();
  });
});
