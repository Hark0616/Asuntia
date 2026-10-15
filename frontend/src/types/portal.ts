/** Información autorizada para la vista externa del expediente. */
export interface NovedadPortalAPI {
  id: string;
  titulo: string;
  descripcion: string;
  tipo: 'nota' | 'paso_completado' | 'documento_incorporado';
  created_at: string;
}

export interface AsuntoPortalAPI {
  id: string;
  radicado: string;
  fecha_apertura: string;
  responsable_nombre: string | null;
  ultima_novedad_at: string | null;
  novedades: NovedadPortalAPI[];
}
