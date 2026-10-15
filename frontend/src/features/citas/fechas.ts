/** La captura usa la zona de la cita, aunque el dispositivo esté en otra zona. */
export function fechaEnZona(iso: string, zona: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const value = (key: string) => parts.find(part => part.type === key)?.value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}

export function instanteEnZona(local: string, zona: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error('Introduce fecha y hora completas.');
  const approximate = Date.parse(`${local}:00Z`);
  const offsets = new Set<number>();
  for (const shift of [-86_400_000, 0, 86_400_000]) {
    const instant = approximate + shift;
    offsets.add(Date.parse(`${fechaEnZona(new Date(instant).toISOString(), zona)}:00Z`) - instant);
  }
  const matches = [...offsets].map(offset => approximate - offset)
    .filter(instant => fechaEnZona(new Date(instant).toISOString(), zona) === local);
  if (matches.length !== 1) throw new Error(matches.length ? 'Esta hora se repite por el cambio de horario. Elige otra hora.' : 'Esta hora no existe en la zona de la cita.');
  return new Date(matches[0]).toISOString();
}

export function mostrarCita(iso: string, zona: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: zona, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
