import React, { useState } from 'react';
import { ShieldCheck, Mail, ArrowRight, ExternalLink } from 'lucide-react';
import { apiClient } from '@/lib/axios';

interface ClienteOTPLoginProps {
  onSuccess: (user: any) => void;
}

export function ClienteOTPLogin({ onSuccess }: ClienteOTPLoginProps) {
  const [step, setStep] = useState<'cedula' | 'otp'>('cedula');
  const [cedula, setCedula] = useState('1.094.852.140');
  const [code, setCode] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSolicitarOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula.trim()) return;

    setLoading(true);
    setError('');

    try {
      await apiClient.post('/auth/otp/request', { cedula });
      setStep('otp');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al solicitar código de verificación.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/auth/otp/verify', { cedula, code });
      onSuccess(response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Código de verificación incorrecto.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '40px auto 0', padding: '0 16px' }}>
      <div className="panel" style={{ padding: '28px 24px', textAlign: 'center' }}>
        <div 
          className="brand-mark" 
          style={{ width: '48px', height: '48px', margin: '0 auto 16px', fontSize: '24px' }}
        >
          A
        </div>

        <h2 style={{ fontSize: '22px', margin: '0 0 6px' }}>Consultar Estado de Asunto</h2>
        <p className="muted small" style={{ marginBottom: '24px' }}>
          Sin contraseñas. Ingresa tu número de documento para recibir un acceso seguro.
        </p>

        {error && (
          <div className="badge danger" style={{ width: '100%', marginBottom: '16px', padding: '8px 12px' }}>
            {error}
          </div>
        )}

        {step === 'cedula' && (
          <form onSubmit={handleSolicitarOTP} className="stack">
            <div className="field">
              <label htmlFor="cedula" style={{ textAlign: 'left' }}>Número de Cédula / Documento</label>
              <input
                id="cedula"
                type="text"
                required
                value={cedula}
                onChange={(e) => setCedula(e.target.value)}
                placeholder="Ej. 1.094.852.140"
                style={{ height: '44px', fontSize: '15px' }}
              />
            </div>

            <button 
              className="primary-button" 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', height: '44px', marginTop: '8px', fontSize: '15px' }}
            >
              {loading ? 'Enviando código...' : 'Continuar con Cédula'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerificarOTP} className="stack">
            <div className="badge warning" style={{ width: '100%', justifyContent: 'center', padding: '8px' }}>
              <Mail size={14} />
              Código enviado al correo (Dev: 123456)
            </div>

            <div className="field" style={{ marginTop: '12px' }}>
              <label htmlFor="otp-code" style={{ textAlign: 'left' }}>Código de Verificación (6 dígitos)</label>
              <input
                id="otp-code"
                type="text"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                style={{ height: '48px', fontSize: '20px', textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' }}
              />
            </div>

            <button 
              className="primary-button" 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', height: '44px', marginTop: '8px', fontSize: '15px' }}
            >
              {loading ? 'Verificando...' : 'Ingresar a mi expediente'}
              <ShieldCheck size={16} />
            </button>

            <div style={{ marginTop: '16px', borderTop: '1px dashed var(--line)', paddingTop: '12px' }}>
              <a 
                href="http://localhost:8025" 
                target="_blank" 
                rel="noreferrer"
                className="muted small row"
                style={{ justifyContent: 'center', textDecoration: 'none', color: 'var(--brand)' }}
              >
                <ExternalLink size={13} />
                Abrir Mailpit local (ver correo dev)
              </a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
