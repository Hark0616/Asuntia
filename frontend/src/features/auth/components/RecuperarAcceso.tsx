import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Tooltip } from '@/components/ui/Tooltip';
import { advanceSessionGeneration } from '@/lib/session';
import { mensajeAuth, restablecerPasswordAPI, solicitarRecuperacionAPI } from '../api/auth';
import { firmaInicial } from '../firmaAcceso';
import { FirmaAccesoField } from './FirmaAccesoField';
import '../auth.css';

export function RecuperarAcceso({ search, hash }: { search: string; hash: string }) {
  const client = useQueryClient();
  const [firm, setFirm] = useState(() => firmaInicial(search, import.meta.env.VITE_FIRMA_SLUG));
  const [link] = useState(() => {
    const fragment = new URLSearchParams(hash.replace(/^#/, ''));
    return { challenge_id: fragment.get('challenge') || '', token: fragment.get('token') || '', provided: Boolean(hash) };
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const request = useMutation({ mutationFn: () => solicitarRecuperacionAPI(firm, email), gcTime: 0 });
  const reset = useMutation({ mutationFn: restablecerPasswordAPI, gcTime: 0, onSuccess: () => {
    advanceSessionGeneration();
    client.cancelQueries();
    client.clear();
    client.setQueryData(['auth', 'me'], null);
    setPassword(''); setConfirmation('');
  } });
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const valid = firm && /^[\da-f-]{36}$/i.test(link.challenge_id) && /^[\w-]{43}$/.test(link.token);
  const requestUrl = `/recuperar-acceso?firma=${encodeURIComponent(firm)}`;
  return <main className="app-shell auth-recovery-shell">
    <section className="panel auth-recovery" aria-labelledby="recovery-title">
      <h1 id="recovery-title">{link.provided ? 'Crear nueva contraseña' : 'Recuperar acceso'}</h1>
      {link.provided ? reset.isSuccess ? <>
        <p role="status">Contraseña actualizada.</p>
        <Link className="primary-button" to={`/?firma=${encodeURIComponent(firm)}`}>Iniciar sesión</Link>
      </> : !valid ? <>
        <p className="form-error" role="alert">Enlace incompleto.</p>
        <Link to={requestUrl}>Solicitar otro enlace</Link>
      </> : <form className="auth-recovery-form" onSubmit={event => {
        event.preventDefault();
        if (password !== confirmation) { setMismatch(true); return; }
        setMismatch(false);
        reset.mutate({ firma_slug: firm, challenge_id: link.challenge_id, token: link.token, password });
      }}>
        <span className="muted">Firma: {firm}</span>
        <label className="field">Nueva contraseña<input type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" value={password} disabled={reset.isPending}
          onChange={event => setPassword(event.target.value)} aria-describedby="new-password-help" /></label>
        <span id="new-password-help" className="muted small">Mínimo 12 caracteres.</span>
        <label className="field">Confirmar contraseña<input type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" value={confirmation} disabled={reset.isPending}
          onChange={event => setConfirmation(event.target.value)} /></label>
        {mismatch && <p className="form-error" role="alert">Las contraseñas no coinciden.</p>}
        {reset.isError && <p className="form-error" role="alert">{mensajeAuth(reset.error, 'No se pudo actualizar la contraseña. Inténtalo de nuevo.')}</p>}
        <button className="primary-button" disabled={reset.isPending}>{reset.isPending ? 'Guardando…' : 'Guardar contraseña'}</button>
        <Link to={requestUrl}>Solicitar otro enlace</Link>
      </form> : request.isSuccess ? <div className="auth-recovery-form">
        <p role="status">Revisa tu correo <Tooltip content={request.data.message} /></p>
        <span className="muted small">El enlace vence en {Math.ceil(request.data.expires_in_seconds / 60)} min.</span>
        <button className="secondary-button" onClick={() => request.reset()}>Solicitar otro enlace</button>
      </div> : <form className="auth-recovery-form" onSubmit={event => { event.preventDefault(); request.mutate(); }}>
        <FirmaAccesoField value={firm} onChange={setFirm} disabled={request.isPending} />
        <label className="field">Correo de la oficina<input type="email" required autoComplete="username" value={email}
          onChange={event => setEmail(event.target.value)} disabled={request.isPending} /></label>
        {request.isError && <p className="form-error" role="alert">{mensajeAuth(request.error, 'No se pudo solicitar el enlace. Inténtalo de nuevo.')}</p>}
        <button className="primary-button" disabled={request.isPending}>{request.isPending ? 'Solicitando…' : 'Solicitar enlace'}</button>
      </form>}
      {!reset.isSuccess && <Link className="auth-recovery-link" to={`/?firma=${encodeURIComponent(firm)}`}>Volver al ingreso</Link>}
    </section>
  </main>;
}
