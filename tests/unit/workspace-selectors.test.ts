import { describe, expect, test } from "vitest";
import { seedData } from "../../src/lib/seed";
import type { WorkspaceData } from "../../src/lib/types";
import {
  findCaseByTrackingCode,
  getCaseDocuments,
  getCaseMilestones,
  getCaseUpdates,
  getCurrentMilestone,
  resolveClientTracking,
} from "../../src/lib/workspace-selectors";

function cloneWorkspace(data: WorkspaceData = seedData): WorkspaceData {
  return JSON.parse(JSON.stringify(data)) as WorkspaceData;
}

describe("workspace selectors", () => {
  test("finds cases by tracking code without depending on casing or whitespace", () => {
    const legalCase = findCaseByTrackingCode(seedData, "  as-2026-001 ");

    expect(legalCase?.id).toBe("case-1");
    expect(legalCase?.title).toBe("Licitacion municipal 2026");
  });

  test("resolves the client tracking model without leaking internal updates or documents", () => {
    const workspace = cloneWorkspace();
    workspace.documents.push({
      id: "doc-internal",
      caseId: "case-1",
      name: "Analisis_interno.pdf",
      category: "Estrategia",
      visibility: "internal",
      status: "en_revision",
      uploadedAt: "2026-07-05T10:00:00.000Z",
    });
    workspace.updates.push({
      id: "update-internal",
      caseId: "case-1",
      author: "Daniela Torres",
      body: "No visible para cliente.",
      visibility: "internal",
      createdAt: "2026-07-06T09:00:00.000Z",
    });

    const model = resolveClientTracking(workspace, "AS-2026-001");

    expect(model?.client.id).toBe("client-1");
    expect(model?.legalCase.id).toBe("case-1");
    expect(model?.documents.every((document) => document.visibility === "client")).toBe(true);
    expect(model?.updates.every((update) => update.visibility === "client")).toBe(true);
    expect(model?.documents.map((document) => document.id)).not.toContain("doc-internal");
    expect(model?.updates.map((update) => update.id)).not.toContain("update-internal");
  });

  test("orders case artifacts in the shape expected by cliente and firma portals", () => {
    const workspace = cloneWorkspace();
    workspace.documents.push({
      id: "doc-newer",
      caseId: "case-1",
      name: "Certificado_actualizado.pdf",
      category: "Certificados",
      visibility: "client",
      status: "recibido",
      uploadedAt: "2026-07-06T10:00:00.000Z",
    });

    const milestones = getCaseMilestones(workspace, "case-1");
    const documents = getCaseDocuments(workspace, "case-1", "client");
    const updates = getCaseUpdates(workspace, "case-1", "client");

    expect(milestones.map((milestone) => milestone.id)).toEqual([
      "milestone-1",
      "milestone-2",
      "milestone-3",
      "milestone-4",
      "milestone-5",
    ]);
    expect(getCurrentMilestone(milestones)?.id).toBe("milestone-3");
    expect(documents[0]?.id).toBe("doc-newer");
    expect(updates[0]?.id).toBe("update-1");
  });

  test("resolves a larger workspace within an interactive processing budget", () => {
    const workspace = cloneWorkspace();

    for (let index = 0; index < 700; index += 1) {
      const caseId = `case-bulk-${index}`;
      workspace.cases.push({
        id: caseId,
        clientId: "client-1",
        trackingCode: `AS-BULK-${index}`,
        title: `Asunto de carga ${index}`,
        description: "Prueba de volumen local.",
        status: "en_curso",
        priority: "normal",
        responsible: "Daniela Torres",
        nextStep: "Revisar informacion.",
        createdAt: "2026-07-01T10:00:00.000Z",
        updatedAt: "2026-07-04T14:15:00.000Z",
      });
      workspace.milestones.push({
        id: `milestone-bulk-${index}`,
        caseId,
        title: "Revision",
        description: "Hito de prueba.",
        detail: "Detalle de prueba.",
        date: "2026-07-04",
        status: "current",
        evidenceEnabled: false,
      });
      workspace.documents.push({
        id: `doc-bulk-${index}`,
        caseId,
        name: `doc-${index}.pdf`,
        category: "General",
        visibility: "client",
        status: "recibido",
        uploadedAt: "2026-07-04T10:00:00.000Z",
      });
    }

    const startedAt = performance.now();
    const model = resolveClientTracking(workspace, "AS-BULK-699");
    const durationMs = performance.now() - startedAt;

    expect(model?.legalCase.id).toBe("case-bulk-699");
    expect(model?.documents).toHaveLength(1);
    expect(durationMs).toBeLessThan(100);
  });
});
