import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { loginOficinaAPI, mensajeAuth } from '@/features/auth/api/auth';
import type { User } from '@/types/api';
import { FirmaAccesoField } from './FirmaAccesoField';

interface OficinaLoginProps {
  onSuccess: (user: User) => void;
  firmaSlug: string;
  onFirmaChange: (value: string) => void;
}

export function OficinaLogin({ onSuccess, firmaSlug, onFirmaChange }: OficinaLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !firmaSlug.trim()) return;
    setLoading(true);
    setError('');
    try {
      onSuccess(await loginOficinaAPI(email, password, firmaSlug));
    } catch (err: unknown) {
      setError(mensajeAuth(err, 'No fue posible iniciar sesión.'));
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

        <h2 style={{ fontSize: '22px', margin: '0 0 6px' }}>Acceso a Oficina</h2>
        <p className="muted small" style={{ marginBottom: '24px' }}>
          Portal exclusivo para abogados y equipo de la firma Asuntia.
        </p>

        {error && (
          <div className="badge danger" style={{ width: '100%', marginBottom: '16px', padding: '8px 12px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="stack">
          <FirmaAccesoField value={firmaSlug} onChange={onFirmaChange} disabled={loading} />
          <div className="field">
            <label htmlFor="email" style={{ textAlign: 'left' }}>Correo Institucional</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="abogado@asuntia.com"
              style={{ height: '44px', fontSize: '15px' }}
            />
          </div>

          <div className="field">
            <label htmlFor="password" style={{ textAlign: 'left' }}>Contraseña</label>
            <input
              id="password"
              type="password"
              maxLength={128}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ height: '44px', fontSize: '15px' }}
            />
          </div>

          <button 
            className="primary-button" 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', height: '44px', marginTop: '8px', fontSize: '15px' }}
          >
            {loading ? 'Iniciando sesión...' : 'Ingresar a Tablero'}
            <LogIn size={16} />
          </button>
        </form>
        <a className="auth-recovery-link" href={`/recuperar-acceso?firma=${encodeURIComponent(firmaSlug)}`}>Olvidé mi contraseña</a>
      </div>
    </div>
  );
}
