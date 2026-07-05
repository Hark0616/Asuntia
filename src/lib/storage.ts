import { seedData } from "./seed";
import type { AuditEvent, WorkspaceData } from "./types";

export const STORAGE_KEY = "asuntia.mvp.workspace";

export function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function getTodayIso() {
  return new Date().toISOString();
}

export function cloneSeed(): WorkspaceData {
  return JSON.parse(JSON.stringify(seedData)) as WorkspaceData;
}

function normalizeWorkspace(data: WorkspaceData): WorkspaceData {
  const seeded = cloneSeed();
  const seedCasesById = new Map(seeded.cases.map((legalCase) => [legalCase.id, legalCase]));
  const existingMilestoneIds = new Set((data.milestones ?? []).map((milestone) => milestone.id));

  return {
    ...data,
    cases: data.cases.map((legalCase, index) => ({
      ...legalCase,
      trackingCode:
        legalCase.trackingCode ??
        seedCasesById.get(legalCase.id)?.trackingCode ??
        `AS-DEMO-${String(index + 1).padStart(3, "0")}`,
    })),
    milestones: [
      ...(data.milestones ?? []),
      ...seeded.milestones.filter((milestone) => !existingMilestoneIds.has(milestone.id)),
    ],
  };
}

export function loadWorkspace(): WorkspaceData {
  if (typeof window === "undefined") {
    return cloneSeed();
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as WorkspaceData;
    const normalized = normalizeWorkspace(parsed);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const seeded = cloneSeed();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

export function saveWorkspace(data: WorkspaceData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function audit(actor: string, action: string, target: string): AuditEvent {
  return {
    id: createId("audit"),
    actor,
    action,
    target,
    createdAt: getTodayIso(),
  };
}
