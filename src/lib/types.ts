export type CaseStatus =
  | "nuevo"
  | "en_curso"
  | "requiere_cliente"
  | "en_espera"
  | "finalizado";

export type RequestStatus =
  | "pendiente"
  | "en_progreso"
  | "recibida"
  | "requiere_correccion"
  | "aceptada"
  | "vencida";

export type Visibility = "internal" | "client";

export type MilestoneStatus = "completed" | "current" | "upcoming";

export type Client = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: string;
};

export type LegalCase = {
  id: string;
  clientId: string;
  trackingCode: string;
  title: string;
  description: string;
  status: CaseStatus;
  priority: "normal" | "alta";
  responsible: string;
  nextStep: string;
  createdAt: string;
  updatedAt: string;
};

export type CaseMilestone = {
  id: string;
  caseId: string;
  title: string;
  description: string;
  detail: string;
  date: string;
  status: MilestoneStatus;
  evidenceEnabled: boolean;
};

export type CaseUpdate = {
  id: string;
  caseId: string;
  author: string;
  body: string;
  visibility: Visibility;
  createdAt: string;
};

export type InfoRequest = {
  id: string;
  caseId: string;
  title: string;
  detail: string;
  owner: string;
  dueDate: string;
  status: RequestStatus;
  createdAt: string;
};

export type CaseDocument = {
  id: string;
  caseId: string;
  milestoneId?: string;
  name: string;
  category: string;
  visibility: Visibility;
  status: "recibido" | "en_revision" | "aprobado" | "rechazado";
  uploadedAt: string;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: string;
  target: string;
  createdAt: string;
};

export type WorkspaceData = {
  clients: Client[];
  cases: LegalCase[];
  milestones: CaseMilestone[];
  updates: CaseUpdate[];
  requests: InfoRequest[];
  documents: CaseDocument[];
  audit: AuditEvent[];
};
