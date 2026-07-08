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

export type UserRole = "owner" | "admin" | "lawyer" | "assistant" | "client";

export type ProfileStatus = "active" | "inactive";

export type PublicContentStatus = "draft" | "published";

export type Firm = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  specialty: string;
  contactEmail: string;
  contactPhone?: string;
  createdAt: string;
};

export type FirmPublicSite = {
  id: string;
  firmId: string;
  headline: string;
  subheadline: string;
  heroSummary: string;
  trustStatement: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  heroImageUrl: string;
  status: PublicContentStatus;
  updatedAt: string;
};

export type FirmPracticeArea = {
  id: string;
  firmId: string;
  slug: string;
  title: string;
  summary: string;
  audience: string;
  sortOrder: number;
};

export type FirmGuide = {
  id: string;
  firmId: string;
  practiceAreaId?: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  readingMinutes: number;
  status: PublicContentStatus;
  sortOrder: number;
  publishedAt?: string;
};

export type FirmCaseStudy = {
  id: string;
  firmId: string;
  practiceAreaId?: string;
  slug: string;
  title: string;
  scenario: string;
  approach: string;
  outcomeSummary: string;
  disclaimer: string;
  sortOrder: number;
};

export type FirmValueProp = {
  id: string;
  firmId: string;
  title: string;
  body: string;
  sortOrder: number;
};

export type Profile = {
  id: string;
  firmId: string;
  clientId?: string;
  email: string;
  name: string;
  role: UserRole;
  status: ProfileStatus;
  createdAt: string;
};

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
  firms: Firm[];
  publicSites: FirmPublicSite[];
  practiceAreas: FirmPracticeArea[];
  guides: FirmGuide[];
  caseStudies: FirmCaseStudy[];
  valueProps: FirmValueProp[];
  profiles: Profile[];
  clients: Client[];
  cases: LegalCase[];
  milestones: CaseMilestone[];
  updates: CaseUpdate[];
  requests: InfoRequest[];
  documents: CaseDocument[];
  audit: AuditEvent[];
};
