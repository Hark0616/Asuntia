import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, CheckCircle2, RefreshCw, Link2, Server, Cloud } from 'lucide-react';
import { 
  fetchFirmaStorageConfig, 
  updateFirmaStorageConfig, 
  testStorageConnection, 
  getOAuthAuthUrl 
} from '@/features/firma/api/firmaStorage';
import { Tooltip } from '@/components/ui/Tooltip';

export function ConfiguracionAlmacenamiento() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['firma-storage-config'],
    queryFn: fetchFirmaStorageConfig
  });

  const mutacionGuardarConfig = useMutation({
    mutationFn: updateFirmaStorageConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firma-storage-config'] });
    }
  });

  const handleSeleccionarProveedor = (provider: 'google_drive' | 'onedrive' | 'local') => {
    mutacionGuardarConfig.mutate({
      provider,
      auth_type: provider === 'local' ? 'local' : 'oauth2',
      is_active: true
    });
  };

  const handleConectarOAuth = async (provider: 'google_drive' | 'onedrive') => {
    try {
      const data = await getOAuthAuthUrl(provider);
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (e) {
      alert('No se pudo generar la URL de autenticación OAuth2.');
    }
  };

  const handleProbarConexion = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testStorageConnection();
      setTestResult(`🟢 ${res.message} (${res.provider})`);
      queryClient.invalidateQueries({ queryKey: ['firma-storage-config'] });
    } catch (e: any) {
      setTestResult(`🔴 Error probando conexión: ${e.response?.data?.detail || e.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return <div className="panel" style={{ padding: '24px', textAlign: 'center' }}>Cargando configuración de almacenamiento...</div>;
  }

  const providerActivo = config?.provider || 'mock';

  return (
    <div className="panel" style={{ marginTop: '20px' }}>
      <div className="section-title">
        <h3>
          Almacenamiento de la Firma
          <Tooltip content="Configura dónde se crearán automáticamente los expedientes y carpetas oficiales de tu firma legal." />
        </h3>
        <HardDrive size={18} />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <p className="muted small">
          Elige la nube o servidor corporativo donde Asuntia creará las 4 carpetas estandarizadas de cada caso (<code>01_Anexos</code>, <code>02_Solicitud</code>, <code>03_Audiencias</code>, <code>04_Liquidacion</code>).
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* OP CION GOOGLE DRIVE */}
        <div 
          className={`panel ${providerActivo === 'google_drive' ? 'active' : ''}`}
          style={{ 
            padding: '18px', 
            cursor: 'pointer', 
            border: providerActivo === 'google_drive' ? '2px solid var(--brand)' : '1px solid var(--border)',
            borderRadius: '8px',
            backgroundColor: providerActivo === 'google_drive' ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
          }}
          onClick={() => handleSeleccionarProveedor('google_drive')}
        >
          <div className="row between" style={{ marginBottom: '12px' }}>
            <Cloud size={24} color="#4285F4" />
            {providerActivo === 'google_drive' && <CheckCircle2 size={18} color="#10b981" />}
          </div>
          <strong>Google Drive</strong>
          <p className="muted small" style={{ margin: '6px 0 12px' }}>Cuentas corporativas Google Workspace mediante OAuth2.</p>
          <button 
            type="button" 
            className="secondary-button" 
            style={{ width: '100%', fontSize: '13px', padding: '6px 12px' }}
            onClick={(e) => { e.stopPropagation(); handleConectarOAuth('google_drive'); }}
          >
            <Link2 size={14} /> Conectar Google
          </button>
        </div>

        {/* OPCION ONEDRIVE */}
        <div 
          className={`panel ${providerActivo === 'onedrive' ? 'active' : ''}`}
          style={{ 
            padding: '18px', 
            cursor: 'pointer', 
            border: providerActivo === 'onedrive' ? '2px solid var(--brand)' : '1px solid var(--border)',
            borderRadius: '8px',
            backgroundColor: providerActivo === 'onedrive' ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
          }}
          onClick={() => handleSeleccionarProveedor('onedrive')}
        >
          <div className="row between" style={{ marginBottom: '12px' }}>
            <Cloud size={24} color="#0078D4" />
            {providerActivo === 'onedrive' && <CheckCircle2 size={18} color="#10b981" />}
          </div>
          <strong>OneDrive / M365</strong>
          <p className="muted small" style={{ margin: '6px 0 12px' }}>Microsoft 365 corporativo vía Microsoft Graph API.</p>
          <button 
            type="button" 
            className="secondary-button" 
            style={{ width: '100%', fontSize: '13px', padding: '6px 12px' }}
            onClick={(e) => { e.stopPropagation(); handleConectarOAuth('onedrive'); }}
          >
            <Link2 size={14} /> Conectar M365
          </button>
        </div>

        {/* OPCION SERVIDOR LOCAL */}
        <div 
          className={`panel ${providerActivo === 'local' ? 'active' : ''}`}
          style={{ 
            padding: '18px', 
            cursor: 'pointer', 
            border: providerActivo === 'local' ? '2px solid var(--brand)' : '1px solid var(--border)',
            borderRadius: '8px',
            backgroundColor: providerActivo === 'local' ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
          }}
          onClick={() => handleSeleccionarProveedor('local')}
        >
          <div className="row between" style={{ marginBottom: '12px' }}>
            <Server size={24} color="#64748b" />
            {providerActivo === 'local' && <CheckCircle2 size={18} color="#10b981" />}
          </div>
          <strong>Servidor Local</strong>
          <p className="muted small" style={{ margin: '6px 0 12px' }}>Almacenamiento directo en disco/servidor propio de la firma.</p>
          <button 
            type="button" 
            className="secondary-button" 
            style={{ width: '100%', fontSize: '13px', padding: '6px 12px' }}
          >
            Activo en disco
          </button>
        </div>
      </div>

      <div className="row between wrap" style={{ paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
        <div>
          <span className="muted small">Estado actual: </span>
          <strong>{providerActivo.toUpperCase()}</strong>
          {config?.last_verified_at && (
            <span className="muted small" style={{ marginLeft: '12px' }}>
              Última prueba: {new Date(config.last_verified_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>

        <button 
          className="secondary-button" 
          type="button" 
          onClick={handleProbarConexion}
          disabled={testing}
        >
          <RefreshCw size={14} className={testing ? 'spin' : ''} />
          {testing ? 'Verificando...' : 'Probar Conexión'}
        </button>
      </div>

      {testResult && (
        <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '6px', backgroundColor: 'var(--surface-hover)', fontSize: '13px' }}>
          {testResult}
        </div>
      )}
    </div>
  );
}
