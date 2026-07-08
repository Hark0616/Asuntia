import type { FirmWorkQueueKind, FirmWorkQueueSeverity } from "./workspace-selectors";
import type { CaseStatus, MilestoneStatus, RequestStatus, Visibility } from "./types";

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

export const milestoneStatusLabels: Record<MilestoneStatus, string> = {
  completed: "Completado",
  current: "Actual",
  upcoming: "Siguiente",
};

export const visibilityLabels: Record<Visibility, string> = {
  internal: "Interno",
  client: "Cliente",
};

export const workQueueKindLabels: Record<FirmWorkQueueKind, string> = {
  case_attention: "Accion cliente",
  request_due: "Solicitud",
  milestone_due: "Hito",
};

export const workQueueSeverityLabels: Record<FirmWorkQueueSeverity, string> = {
  high: "Alta",
  medium: "Media",
  normal: "Normal",
};
