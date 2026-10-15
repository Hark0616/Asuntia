import { useQueryClient } from '@tanstack/react-query';
import { EditarRegistro, type CampoEdicion } from '@/components/ui/EditarRegistro';
import { actualizarDatosAsuntoAPI, fetchAsunto } from '../api/asuntos';
import type { AsuntoDatosUpdatePayload } from '@/types/asunto';

const campos: CampoEdicion[] = [
  { key: 'titulo', label: 'Título del asunto', required: true, maxLength: 255 },
  { key: 'radicado_oficial', label: 'Radicado oficial', maxLength: 100, help: 'Se actualiza la referencia del expediente. Las actuaciones ya completadas conservan su información histórica.' },
  { key: 'fecha_apertura', label: 'Fecha de apertura', type: 'date', required: true },
];

export function EditarAsunto({ asuntoId }: { asuntoId: string }) {
  const queryClient = useQueryClient();
  return <EditarRegistro title="Editar asunto" campos={campos} queryKey={['asuntos', 'edicion', asuntoId]}
    cargar={async () => {
      const data = await fetchAsunto(asuntoId);
      return { version: data.updated_at, values: { titulo: data.titulo, radicado_oficial: data.radicado_oficial || '', fecha_apertura: data.fecha_apertura } };
    }} guardar={async ({ version, values }) => {
      const payload: AsuntoDatosUpdatePayload = { expected_updated_at: version, titulo: values.titulo,
        radicado_oficial: values.radicado_oficial.trim() || null, fecha_apertura: values.fecha_apertura };
      await actualizarDatosAsuntoAPI(asuntoId, payload);
      await Promise.all(['asuntos', 'tareas'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
    }} />;
}
