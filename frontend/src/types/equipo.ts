export type RolEquipo = 'administrador' | 'abogado' | 'auxiliar';

export interface MiembroEquipo {
  id: string;
  nombre: string;
  email: string;
  cedula: string;
  rol: RolEquipo;
  estado: 'activo' | 'invitado' | 'inactivo';
  updated_at: string;
  clientes: number;
  asuntos: number;
  tareas_pendientes: number;
  tareas_fuera_de_asuntos: number;
}

export interface InvitacionEquipo {
  miembro: MiembroEquipo;
  firma_slug: string;
  invitacion_id: string;
  token: string;
  expires_at: string;
}

export interface AltaEquipo {
  nombre: string;
  email: string;
  cedula: string;
  rol: RolEquipo;
}

export interface CambioEquipo {
  id: string;
  expected_updated_at: string;
  reasignar_a_id?: string;
  rol?: RolEquipo;
}
