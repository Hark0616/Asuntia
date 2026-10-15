function instante(iso: string): Date {
  // Las audiencias anteriores al contrato aware se registraron en hora de Bogotá.
  const conZona = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}-05:00`;
  return new Date(conZona);
}

export function fechaRegistroISO(iso: string): string {
  return instante(iso).toISOString();
}

export function fechaLocalInput(iso: string | null): string {
  if (!iso) return '';
  const fecha = instante(iso);
  const local = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fechaISO(input: string): string | null {
  return input ? new Date(input).toISOString() : null;
}

export function fechaTrabajo(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short',
  }).format(instante(iso));
}
