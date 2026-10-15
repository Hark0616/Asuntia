import React, { useState } from 'react';
import { ShieldCheck, Mail, ArrowRight, ExternalLink } from 'lucide-react';
import { mensajeAuth, solicitarOTPAPI, verificarOTPAPI } from '@/features/auth/api/auth';
import type { User } from '@/types/api';
import { FirmaAccesoField } from './FirmaAccesoField';
import { Tooltip } from '@/components/ui/Tooltip';

interface ClienteOTPLoginProps {
  onSuccess: (user: User) => void;
  firmaSlug: string;
  onFirmaChange: (value: string) => void;
}

const formatCedulaInput = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export function ClienteOTPLogin({ onSuccess, firmaSlug, onFirmaChange }: ClienteOTPLoginProps) {
  const isDevelopment = import.meta.env.DEV;
  const [step, setStep] = useState<'cedula' | 'otp'>('cedula');
  const [cedula, setCedula] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiresIn, setExpiresIn] = useState<number | null>(null);

  const handleCedulaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCedula(formatCedulaInput(e.target.value));
  };

  const handleSolicitarOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !cedula.trim() || !firmaSlug.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await solicitarOTPAPI(firmaSlug, cedula);
      setExpiresIn(result.expires_in_seconds);
      setStep('otp');
    } catch (err: unknown) {
      setError(mensajeAuth(err, 'Error de verificación.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !code.trim() || !firmaSlug.trim()) return;

    setLoading(true);
    setError('');

    try {
      onSuccess(await verificarOTPAPI(firmaSlug, cedula, code));
    } catch (err: unknown) {
      setError(mensajeAuth(err, 'Código incorrecto.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '48px auto 0', padding: '0 16px' }}>
      <div className="panel" style={{ padding: '32px 24px', textAlign: 'center' }}>
        <div 
          className="brand-mark" 
          style={{ width: '44px', height: '44px', margin: '0 auto 16px', fontSize: '22px' }}
        >
          A
        </div>

        <h2 style={{ fontSize: '20px', margin: '0 0 4px', fontWeight: 600 }}>Consulta de Expediente</h2>
        <p className="muted small" style={{ marginBottom: '24px' }}>
          Ingresa tu documento para acceder
        </p>

        {error && (
          <div className="badge danger" style={{ width: '100%', marginBottom: '16px', padding: '8px 12px' }}>
            {error}
          </div>
        )}

        {step === 'cedula' && (
          <form onSubmit={handleSolicitarOTP} className="stack">
            <FirmaAccesoField value={firmaSlug} onChange={onFirmaChange} disabled={loading} />
            <div className="field">
              <label htmlFor="cedula" style={{ textAlign: 'left' }}>Cédula de ciudadanía</label>
              <input
                id="cedula"
                type="text"
                inputMode="numeric"
                required
                value={cedula}
                onChange={handleCedulaChange}
                placeholder="Cédula o NIT"
                style={{ height: '44px', fontSize: '15px' }}
              />
            </div>

            <button 
              className="primary-button" 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', height: '44px', marginTop: '8px', fontSize: '15px' }}
            >
              {loading ? 'Consultando...' : 'Continuar'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerificarOTP} className="stack">
            <div className="badge warning" style={{ width: '100%', justifyContent: 'center', padding: '6px' }}>
              <Mail size={13} />
              Revisa tu correo
              <Tooltip content="Si la firma y el documento coinciden con tu registro, enviaremos un código al correo registrado." />
            </div>
            {expiresIn && <span className="muted small">El código vence en {Math.ceil(expiresIn / 60)} min.</span>}

            <div className="field" style={{ marginTop: '12px' }}>
              <label htmlFor="otp-code" style={{ textAlign: 'left' }}>Código de seguridad</label>
              <input
                id="otp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Código recibido"
                style={{ height: '48px', fontSize: '20px', textAlign: 'center', letterSpacing: '4px', fontWeight: 'bold' }}
              />
            </div>

            <button 
              className="primary-button" 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', height: '44px', marginTop: '8px', fontSize: '15px' }}
            >
              {loading ? 'Verificando...' : 'Ingresar'}
              <ShieldCheck size={16} />
            </button>
            <button className="secondary-button" type="button" disabled={loading} onClick={() => {
              setStep('cedula'); setCode(''); setError('');
            }}>Cambiar firma o documento</button>

            {isDevelopment && (
              <div style={{ marginTop: '16px', borderTop: '1px dashed var(--line)', paddingTop: '12px' }}>
                <a
                  href="http://localhost:8025"
                  target="_blank"
                  rel="noreferrer"
                  className="muted small row"
                  style={{ justifyContent: 'center', textDecoration: 'none', color: 'var(--brand)' }}
                >
                  <ExternalLink size={13} />
                  Mailpit (Bandeja dev)
                </a>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
