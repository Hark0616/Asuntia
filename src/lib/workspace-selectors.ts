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

export type ClientTrackingModel = {
  client: Client;
  documents: CaseDocument[];
  legalCase: LegalCase;
  milestones: CaseMilestone[];
  pendingRequest?: InfoRequest;
  requests: InfoRequest[];
  updates: CaseUpdate[];
};

export function normalizeTrackingCode(value: string) {
  return value.trim().toUpperCase();
}

export function findCaseByTrackingCode(data: WorkspaceData, trackingCode: string) {
  const normalizedCode = normalizeTrackingCode(trackingCode);
  return data.cases.find((item) => normalizeTrackingCode(item.trackingCode) === normalizedCode);
}

export function getClientForCase(data: WorkspaceData, legalCase: LegalCase) {
  return data.clients.find((client) => client.id === legalCase.clientId);
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
