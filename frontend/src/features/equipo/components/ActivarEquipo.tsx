import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router';
import { activarMiembro, errorEquipo } from '../api/equipo';
import '../equipo.css';

export function ActivarEquipo({ search, hash }: { search: string; hash: string }) {
  const [invitation] = useState(() => {
    const fragment = new URLSearchParams(hash.replace(/^#/, ''));
    return { firma_slug: new URLSearchParams(search).get('firma') || '',
      invitacion_id: fragment.get('invitacion') || '', token: fragment.get('token') || '' };
  });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const mutation = useMutation({ mutationFn: activarMiembro, gcTime: 0,
    onSuccess: () => { setPassword(''); setConfirmation(''); } });
  useEffect(() => {
    // El secreto solo vive en esta vista; no queda en el historial del navegador.
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  const valid = invitation.firma_slug && /^[\da-f-]{36}$/i.test(invitation.invitacion_id) && /^[\w-]{43}$/.test(invitation.token);
  return <main className="app-shell team-activation-shell">
    <section className="panel team-activation">
      <h1>Activar acceso a Asuntia</h1>
      {mutation.isSuccess ? <>
        <p role="status">Tu acceso está activo.</p>
        <Link className="primary-button" to={`/?firma=${encodeURIComponent(invitation.firma_slug)}`}>Iniciar sesión</Link>
      </> : !valid ? <p role="alert">Enlace incompleto. Solicita una nueva invitación al administrador.</p> : <form className="team-form"
        onSubmit={event => {
          event.preventDefault();
          if (password !== confirmation) { setMismatch(true); return; }
          setMismatch(false); mutation.mutate({ ...invitation, password });
        }}>
        <span className="muted">Firma: {invitation.firma_slug}</span>
        <label className="field">Contraseña<input type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label>
        <span className="muted small">Mínimo 12 caracteres.</span>
        <label className="field">Confirmar contraseña<input type="password" required minLength={12} maxLength={128}
          autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
        {mismatch && <p className="form-error" role="alert">Las contraseñas no coinciden.</p>}
        {mutation.isError && <p className="form-error" role="alert">{errorEquipo(mutation.error, 'No se pudo activar el acceso. Inténtalo de nuevo.')} Solicita un nuevo enlace si venció.</p>}
        <button className="primary-button" disabled={mutation.isPending}>{mutation.isPending ? 'Activando…' : 'Activar acceso'}</button>
      </form>}
    </section>
  </main>;
}
