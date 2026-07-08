import type {
  CaseDocument,
  CaseMilestone,
  CaseUpdate,
  Client,
  InfoRequest,
  LegalCase,
  Visibility,
  WorkspaceData,
} from "./types";

const closedRequestStatuses = new Set<InfoRequest["status"]>(["aceptada", "recibida"]);
const dayMs = 24 * 60 * 60 * 1000;

export type FirmWorkQueueKind = "case_attention" | "request_due" | "milestone_due";
export type FirmWorkQueueSeverity = "high" | "medium" | "normal";

export type FirmWorkQueueItem = {
  caseId: string;
  clientId: string;
  clientName: string;
  detail: string;
  dueDate?: string;
  id: string;
  kind: FirmWorkQueueKind;
  severity: FirmWorkQueueSeverity;
  title: string;
};

export type ClientTrackingModel = {
  client: Client;
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  pendingRequest?: InfoRequest;
  requests: InfoRequest[];
  updates: CaseUpdate[];
};

export type PublicAccessTarget =
  | {
      client: Client;
      kind: "client";
    }
  | {
      client: Client;
      kind: "case";
      legalCase: LegalCase;
    };

export function normalizeTrackingCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhoneValue(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

export function findCaseByTrackingCode(data: WorkspaceData, trackingCode: string) {
  const normalizedCode = normalizeTrackingCode(trackingCode);
  return data.cases.find((item) => normalizeTrackingCode(item.trackingCode) === normalizedCode);
}

export function getClientForCase(data: WorkspaceData, legalCase: LegalCase) {
  return data.clients.find((client) => client.id === legalCase.clientId);
}

export function findClientByIdentifier(data: WorkspaceData, value: string) {
  const normalizedValue = normalizeLookupValue(value);
  const normalizedPhone = normalizePhoneValue(value);

  if (!normalizedValue) {
    return undefined;
  }

  return data.clients.find((client) => {
    return (
      normalizeLookupValue(client.id) === normalizedValue ||
      normalizeLookupValue(client.email) === normalizedValue ||
      (normalizedPhone.length >= 4 && normalizePhoneValue(client.phone) === normalizedPhone)
    );
  });
}

export function getClientActiveCases(data: WorkspaceData, clientId: string) {
  return data.cases
    .filter((legalCase) => legalCase.clientId === clientId)
    .filter((legalCase) => legalCase.status !== "finalizado")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getCaseMilestones(data: WorkspaceData, caseId: string) {
  return data.milestones
    .filter((milestone) => milestone.caseId === caseId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getCaseUpdates(data: WorkspaceData, caseId: string, visibility?: Visibility) {
  return data.updates
    .filter((update) => update.caseId === caseId)
    .filter((update) => (visibility ? update.visibility === visibility : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCaseRequests(data: WorkspaceData, caseId: string) {
  return data.requests
    .filter((request) => request.caseId === caseId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function getCaseDocuments(data: WorkspaceData, caseId: string, visibility?: Visibility) {
  return data.documents
    .filter((document) => document.caseId === caseId)
    .filter((document) => (visibility ? document.visibility === visibility : true))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export function getCurrentMilestone(milestones: CaseMilestone[]) {
  return milestones.find((milestone) => milestone.status === "current");
}

export function getPendingClientRequest(requests: InfoRequest[]) {
  return requests.find((request) => !closedRequestStatuses.has(request.status));
}

function compareDate(value: string, referenceDate: string) {
  const valueTime = Date.parse(`${value.slice(0, 10)}T00:00:00.000Z`);
  const referenceTime = Date.parse(`${referenceDate}T00:00:00.000Z`);

  if (Number.isNaN(valueTime) || Number.isNaN(referenceTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((valueTime - referenceTime) / dayMs);
}

function getSeverity(daysUntilDue: number, isHighPriority = false): FirmWorkQueueSeverity {
  if (daysUntilDue < 0 || isHighPriority) {
    return "high";
  }

  if (daysUntilDue <= 2) {
    return "medium";
  }

  return "normal";
}

function severityRank(severity: FirmWorkQueueSeverity) {
  if (severity === "high") {
    return 0;
  }

  if (severity === "medium") {
    return 1;
  }

  return 2;
}

export function getFirmWorkQueue(
  data: WorkspaceData,
  referenceDate = new Date().toISOString().slice(0, 10),
) {
  const clientsById = new Map(data.clients.map((client) => [client.id, client]));
  const casesById = new Map(data.cases.map((legalCase) => [legalCase.id, legalCase]));
  const items: FirmWorkQueueItem[] = [];

  for (const request of data.requests) {
    if (closedRequestStatuses.has(request.status)) {
      continue;
    }

    const legalCase = casesById.get(request.caseId);
    const client = legalCase ? clientsById.get(legalCase.clientId) : undefined;
    if (!legalCase || !client) {
      continue;
    }

    const daysUntilDue = compareDate(request.dueDate, referenceDate);

    items.push({
      caseId: legalCase.id,
      clientId: client.id,
      clientName: client.name,
      detail: `${legalCase.title} · ${request.owner}`,
      dueDate: request.dueDate,
      id: `request-${request.id}`,
      kind: "request_due",
      severity: getSeverity(daysUntilDue, request.status === "vencida"),
      title: request.title,
    });
  }

  for (const legalCase of data.cases) {
    if (legalCase.status !== "requiere_cliente") {
      continue;
    }

    const client = clientsById.get(legalCase.clientId);
    if (!client) {
      continue;
    }

    items.push({
      caseId: legalCase.id,
      clientId: client.id,
      clientName: client.name,
      detail: legalCase.nextStep,
      id: `case-${legalCase.id}`,
      kind: "case_attention",
      severity: "high",
      title: legalCase.title,
    });
  }

  for (const milestone of data.milestones) {
    if (!["current", "upcoming"].includes(milestone.status)) {
      continue;
    }

    const legalCase = casesById.get(milestone.caseId);
    const client = legalCase ? clientsById.get(legalCase.clientId) : undefined;
    if (!legalCase || !client) {
      continue;
    }

    const daysUntilDue = compareDate(milestone.date, referenceDate);
    if (daysUntilDue > 7 && !milestone.evidenceEnabled && milestone.status !== "current") {
      continue;
    }

    items.push({
      caseId: legalCase.id,
      clientId: client.id,
      clientName: client.name,
      detail: legalCase.title,
      dueDate: milestone.date,
      id: `milestone-${milestone.id}`,
      kind: "milestone_due",
      severity: getSeverity(daysUntilDue, milestone.evidenceEnabled && daysUntilDue <= 2),
      title: milestone.title,
    });
  }

  return items.sort((a, b) => {
    const severityDifference = severityRank(a.severity) - severityRank(b.severity);
    if (severityDifference !== 0) {
      return severityDifference;
    }

    return (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31");
  });
}

export function resolvePublicAccess(
  data: WorkspaceData,
  value: string,
): PublicAccessTarget | null {
  const legalCase = findCaseByTrackingCode(data, value);

  if (legalCase) {
    const client = getClientForCase(data, legalCase);
    if (!client) {
      return null;
    }

    return {
      client,
      kind: "case",
      legalCase,
    };
  }

  const client = findClientByIdentifier(data, value);
  if (!client) {
    return null;
  }

  return {
    client,
    kind: "client",
  };
}

export function resolveClientTracking(
  data: WorkspaceData,
  trackingCode: string,
): ClientTrackingModel | null {
  const legalCase = findCaseByTrackingCode(data, trackingCode);
  if (!legalCase) {
    return null;
  }

  const client = getClientForCase(data, legalCase);
  if (!client) {
    return null;
  }

  const requests = getCaseRequests(data, legalCase.id);

  return {
    client,
    documents: getCaseDocuments(data, legalCase.id, "client"),
    legalCase,
    milestones: getCaseMilestones(data, legalCase.id),
    pendingRequest: getPendingClientRequest(requests),
    requests,
    updates: getCaseUpdates(data, legalCase.id, "client"),
  };
}
