import type { CaseStatus, RequestStatus, Visibility } from "./types";

export const caseStatusLabels: Record<CaseStatus, string> = {
  nuevo: "Nuevo",
  en_curso: "En curso",
  requiere_cliente: "Requiere cliente",
  en_espera: "En espera",
  finalizado: "Finalizado",
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  recibida: "Recibida",
  requiere_correccion: "Requiere correccion",
  aceptada: "Aceptada",
  vencida: "Vencida",
};

export const visibilityLabels: Record<Visibility, string> = {
  internal: "Interno",
  client: "Cliente",
};
