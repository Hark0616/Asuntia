import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, UsersRound } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';
import type { AltaEquipo, CambioEquipo, InvitacionEquipo, MiembroEquipo, RolEquipo } from '@/types/equipo';
import { cambiarRol, consultarEquipo, enlaceInvitacion, errorEquipo, invitarMiembro, renovarInvitacion, retirarAcceso } from '../api/equipo';
import '../equipo.css';

const roles: Record<RolEquipo, string> = {
  administrador: 'Administrador', abogado: 'Abogado', auxiliar: 'Auxiliar',
};
const estados = { activo: 'Activo', invitado: 'Invitación pendiente', inactivo: 'Sin acceso' };

function OpcionesRol() {
  return Object.entries(roles).map(([value, name]) => <option key={value} value={value}>{name}</option>);
}

function AltaMiembro({ onCreated, onCancel }: { onCreated: (invitation: InvitacionEquipo) => void; onCancel: () => void }) {
  const [data, setData] = useState<AltaEquipo>({ nombre: '', email: '', cedula: '', rol: 'abogado' });
  const mutation = useMutation({ mutationFn: invitarMiembro, onSuccess: onCreated, gcTime: 0 });
  return <form className="team-form" onSubmit={event => { event.preventDefault(); mutation.mutate(data); }}>
    <h3>Invitar al equipo</h3>
    <div className="form-grid">
      <label className="field">Nombre<input required maxLength={255} value={data.nombre}
        onChange={event => setData({ ...data, nombre: event.target.value })} autoComplete="name" /></label>
      <label className="field">Correo<input required type="email" value={data.email}
        onChange={event => setData({ ...data, email: event.target.value })} autoComplete="email" /></label>
      <label className="field">Documento<input required maxLength={50} value={data.cedula}
        onChange={event => setData({ ...data, cedula: event.target.value })} /></label>
      <label className="field">Rol<select value={data.rol}
        onChange={event => setData({ ...data, rol: event.target.value as RolEquipo })}><OpcionesRol /></select></label>
    </div>
    {mutation.isError && <p className="form-error" role="alert">{errorEquipo(mutation.error, 'No se pudo crear la invitación. Inténtalo de nuevo.')}</p>}
    <div className="team-actions">
      <button className="primary-button" disabled={mutation.isPending}>Crear invitación</button>
      <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onCancel}>Cancelar</button>
    </div>
  </form>;
}

function EditarMiembro({ member, members, action, onClose, onSaved }: {
  member: MiembroEquipo; members: MiembroEquipo[]; action: 'rol' | 'baja'; onClose: () => void; onSaved: () => void;
}) {
  const [rol, setRol] = useState<RolEquipo>(member.rol);
  const [replacement, setReplacement] = useState('');
  const mutation = useMutation({ mutationFn: action === 'baja' ? retirarAcceso : cambiarRol, onSuccess: onSaved });
  const allWork = action === 'baja' || rol === 'auxiliar';
  const requiresTransfer = allWork
    ? member.clientes + member.asuntos + member.tareas_pendientes > 0
    : rol === 'abogado' && member.tareas_fuera_de_asuntos > 0;
  return <form className="team-edit" aria-label={`Modificar acceso de ${member.nombre}`}
    onSubmit={event => {
      event.preventDefault();
      const data: CambioEquipo = { id: member.id, expected_updated_at: member.updated_at,
        ...(replacement ? { reasignar_a_id: replacement } : {}), ...(action === 'rol' ? { rol } : {}) };
      mutation.mutate(data);
    }}>
    <h4>{action === 'baja' ? 'Retirar acceso' : 'Cambiar rol'}</h4>
    {action === 'rol' && <label className="field">Nuevo rol<select value={rol}
      onChange={event => { setRol(event.target.value as RolEquipo); setReplacement(''); }}><OpcionesRol /></select></label>}
    {(requiresTransfer || (action === 'baja' && member.estado === 'activo')) && <div className="field">
      <span><label htmlFor={`team-replacement-${member.id}`}>Reasignar trabajo a</label> <Tooltip content="Transfiere clientes, asuntos y tareas pendientes. Conserva el historial y las delegaciones a otros miembros. Para tareas de otros asuntos, elige un administrador." /></span>
      <select id={`team-replacement-${member.id}`} value={replacement} required={requiresTransfer} onChange={event => setReplacement(event.target.value)}>
        <option value="">Seleccionar responsable</option>
        {members.filter(item => item.id !== member.id && item.estado === 'activo' && item.rol !== 'auxiliar')
          .map(item => <option key={item.id} value={item.id}>{item.nombre} · {roles[item.rol]}</option>)}
      </select>
    </div>}
    {mutation.isError && <p className="form-error" role="alert">{errorEquipo(mutation.error, 'No se pudo guardar. Recarga el equipo e inténtalo de nuevo.')}</p>}
    <div className="team-actions">
      <button className={action === 'baja' ? 'secondary-button team-danger' : 'primary-button'}
        disabled={mutation.isPending || (action === 'rol' && rol === member.rol)}>
        {mutation.isPending ? 'Guardando…' : action === 'baja' ? 'Confirmar retiro de acceso' : 'Guardar rol'}
      </button>
      <button type="button" className="secondary-button" onClick={onClose} disabled={mutation.isPending}>Cancelar</button>
    </div>
  </form>;
}

export function GestionEquipo({ currentUserId }: { currentUserId: string }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['equipo', 'gestion'], queryFn: consultarEquipo, retry: false });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string; action: 'rol' | 'baja' } | null>(null);
  const [invitation, setInvitation] = useState<InvitacionEquipo | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const refresh = () => {
    for (const key of ['equipo', 'asuntos', 'clientes', 'tareas', 'citas']) client.invalidateQueries({ queryKey: [key] });
  };
  const created = (value: InvitacionEquipo) => {
    setInvitation(value); setCopyStatus(''); setAdding(false); refresh();
  };
  const renew = useMutation({ mutationFn: renovarInvitacion, onSuccess: created, gcTime: 0 });
  const members = query.data || [];
  return <section className="panel team-panel" aria-labelledby="team-title">
    <div className="section-title">
      <h3 id="team-title"><UsersRound size={18} /> Equipo</h3>
      <div className="team-actions">
        <button className="secondary-button" onClick={() => query.refetch()} disabled={query.isFetching}>Actualizar</button>
        <button className="primary-button" onClick={() => { setAdding(true); setEditing(null); }} disabled={adding}>
          <Plus size={16} /> Invitar miembro
        </button>
      </div>
    </div>
    {invitation && <div className="team-invitation" role="region" aria-label="Enlace de invitación">
      <strong>Invitación para {invitation.miembro.nombre}</strong>
      <span className="muted small">Vence en 24 horas <Tooltip content="Comparte este enlace con el miembro. Se muestra una sola vez y permite crear su contraseña. No se envía un correo automáticamente." /></span>
      <label className="field">Enlace de activación<input readOnly value={enlaceInvitacion(invitation)} onFocus={event => event.target.select()} /></label>
      <div className="team-actions">
        <button type="button" className="secondary-button" onClick={async () => {
          try { await navigator.clipboard.writeText(enlaceInvitacion(invitation)); setCopyStatus('Enlace copiado'); }
          catch { setCopyStatus('Selecciona y copia el enlace'); }
        }}>Copiar enlace</button>
        <button type="button" className="secondary-button" onClick={() => { setInvitation(null); renew.reset(); }}>Cerrar enlace</button>
        <span className="small" role="status">{copyStatus}</span>
      </div>
    </div>}
    {adding && <AltaMiembro onCreated={created} onCancel={() => setAdding(false)} />}
    {query.isLoading && <p role="status">Consultando equipo…</p>}
    {query.isError && <div role="alert">No se pudo consultar el equipo. <button className="secondary-button" onClick={() => query.refetch()}>Reintentar</button></div>}
    {renew.isError && <p className="form-error" role="alert">{errorEquipo(renew.error, 'No se pudo generar el enlace. Recarga el equipo.')}</p>}
    <div className="team-list">
      {members.map(member => <article className="team-member" key={member.id}>
        <div className="team-member-row">
          <div className="team-identity"><strong>{member.nombre}</strong><span>{member.email}</span>
            <span className="muted small">{roles[member.rol]} · {estados[member.estado]}{member.id === currentUserId ? ' · Tú' : ''}</span>
            <span className="muted small">{member.clientes} clientes · {member.asuntos} asuntos · {member.tareas_pendientes} tareas pendientes</span>
          </div>
          {member.id !== currentUserId ? <div className="team-actions">
            <button type="button" className="secondary-button" onClick={() => setEditing({ id: member.id, action: 'rol' })}>Cambiar rol</button>
            {member.estado !== 'activo' && <button type="button" className="secondary-button" disabled={renew.isPending}
              onClick={() => renew.mutate({ id: member.id, expected_updated_at: member.updated_at })}>Generar enlace</button>}
            {member.estado !== 'inactivo' && <button type="button" className="secondary-button team-danger"
              onClick={() => setEditing({ id: member.id, action: 'baja' })}>{member.estado === 'activo' ? 'Retirar acceso' : 'Cancelar invitación'}</button>}
          </div> : <Tooltip content="Otro administrador debe modificar tu acceso. La firma debe conservar al menos uno activo." />}
        </div>
        {editing?.id === member.id && <EditarMiembro key={`${member.id}-${member.updated_at}-${editing.action}`} member={member} members={members}
          action={editing.action} onClose={() => setEditing(null)} onSaved={() => {
            setEditing(null);
            if (invitation?.miembro.id === member.id) { setInvitation(null); renew.reset(); }
            refresh();
          }} />}
      </article>)}
    </div>
  </section>;
}
