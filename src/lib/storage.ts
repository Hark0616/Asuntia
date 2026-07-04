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
    return JSON.parse(raw) as WorkspaceData;
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
