/** El enlace de ingreso puede fijar la firma; la instalación puede preconfigurarla. */
export function firmaInicial(search: string, configured = ''): string {
  const params = new URLSearchParams(search);
  return (params.has('firma') ? params.get('firma') || '' : configured).trim().toLowerCase();
}
