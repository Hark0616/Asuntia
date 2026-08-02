import type { ResponsableAPI } from '@/features/asuntos/api/asuntos';

interface ResponsableAsignacionProps {
  id: string;
  label: string;
  value?: string;
  responsables: ResponsableAPI[];
  canEdit: boolean;
  isPending?: boolean;
  errorMessage?: string;
  onChange: (responsableId: string) => void;
}

export function ResponsableAsignacion({
  id,
  label,
  value,
  responsables,
  canEdit,
  isPending = false,
  errorMessage,
  onChange,
}: ResponsableAsignacionProps) {
  const responsable = responsables.find((item) => item.id === value);
  const responsableNombre = responsable?.nombre || 'Sin asignar';

  return (
    <div className="responsible-assignment">
      <label htmlFor={canEdit ? id : undefined}>{label}</label>
      {canEdit ? (
        <select
          id={id}
          value={value || ''}
          disabled={isPending}
          onChange={(event) => {
            if (event.target.value) {
              onChange(event.target.value);
            }
          }}
        >
          <option value="" disabled>Sin asignar</option>
          {responsables.map((item) => (
            <option key={item.id} value={item.id}>
              {item.nombre}
            </option>
          ))}
        </select>
      ) : (
        <strong>{responsableNombre}</strong>
      )}
      {isPending && <span className="responsible-feedback">Guardando…</span>}
      {errorMessage && (
        <span className="field-error" role="alert">{errorMessage}</span>
      )}
    </div>
  );
}
