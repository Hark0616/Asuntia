import { useQuery, useQueryClient } from '@tanstack/react-query';
import { EditarRegistro, type CampoEdicion } from '@/components/ui/EditarRegistro';
import { actualizarClienteAPI, fetchClienteAPI, type ClienteUpdatePayload } from '../api/clientes';
import type { ClienteAPI } from '@/features/asuntos/api/asuntos';

const campos: CampoEdicion[] = [
  { key: 'nombre', label: 'Nombre o razón social', required: true, maxLength: 255 },
  { key: 'email', label: 'Correo electrónico', type: 'email', required: true, maxLength: 255, help: 'Cambiar el correo o la identificación cierra las sesiones del portal e invalida los códigos de acceso anteriores.' },
  { key: 'tipo_persona', label: 'Tipo de persona', options: [{ value: 'natural', label: 'Natural' }, { value: 'juridica', label: 'Jurídica' }] },
  { key: 'tipo_documento', label: 'Tipo de documento', options: ['CC', 'CE', 'NIT', 'PASAPORTE', 'OTRO'].map(value => ({ value, label: value })) },
  { key: 'numero_documento', label: 'Número de documento', required: true, maxLength: 50 },
  { key: 'telefono', label: 'Teléfono', type: 'tel', maxLength: 50 },
  { key: 'fecha_expedicion', label: 'Fecha de expedición', type: 'date' },
  { key: 'canal_preferido', label: 'Canal preferido', options: [{ value: 'email', label: 'Correo' }, { value: 'telefono', label: 'Teléfono' }, { value: 'whatsapp', label: 'WhatsApp' }] },
  { key: 'direccion', label: 'Dirección', maxLength: 255 },
  { key: 'direccion_notificacion', label: 'Dirección de notificación', maxLength: 255 },
  { key: 'ciudad', label: 'Ciudad', maxLength: 120 },
  { key: 'departamento', label: 'Departamento', maxLength: 120 },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea', maxLength: 2000 },
];

export function EditarCliente({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();
  return <EditarRegistro title="Editar cliente" campos={campos} queryKey={['cliente', clienteId]}
    cargar={async () => {
      const cliente = await fetchClienteAPI(clienteId);
      return { version: cliente.updated_at, values: Object.fromEntries(campos.map(campo => [campo.key, String(cliente[campo.key as keyof ClienteAPI] ?? '')])) };
    }} guardar={async ({ version, values }) => {
      const payload: ClienteUpdatePayload = {
        expected_updated_at: version, nombre: values.nombre, email: values.email,
        tipo_persona: values.tipo_persona as ClienteAPI['tipo_persona'], tipo_documento: values.tipo_documento as ClienteAPI['tipo_documento'],
        numero_documento: values.numero_documento, telefono: values.telefono || null,
        fecha_expedicion: values.fecha_expedicion || null, direccion: values.direccion || null,
        direccion_notificacion: values.direccion_notificacion || null, ciudad: values.ciudad || null,
        departamento: values.departamento || null, canal_preferido: values.canal_preferido as ClienteAPI['canal_preferido'],
        observaciones: values.observaciones || null,
      };
      await actualizarClienteAPI(clienteId, payload);
      await Promise.all(['clientes', 'cliente', 'cliente-perfil', 'asuntos', 'tareas'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    }} />;
}

export function ClienteSeleccionado({ clienteId, canEdit }: { clienteId: string; canEdit: boolean }) {
  const query = useQuery({ queryKey: ['cliente-perfil', clienteId], queryFn: () => fetchClienteAPI(clienteId), retry: false });
  return <section className="panel cliente-seleccionado" aria-label="Datos del cliente">
    {query.isPending ? <p role="status">Consultando cliente…</p> : query.isError ? <div><p role="alert">No pudimos consultar el cliente.</p>
      <button className="secondary-button" onClick={() => query.refetch()}>Reintentar</button></div>
      : <><div className="section-title"><h2>{query.data.nombre}</h2>{canEdit && <EditarCliente clienteId={clienteId} />}</div>
        <p className="muted">{query.data.email} · {query.data.tipo_documento}: {query.data.numero_documento}</p>
        {query.data.telefono && <p className="muted">{query.data.telefono}</p>}</>}
  </section>;
}
