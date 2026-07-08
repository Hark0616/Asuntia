import { describe, expect, test } from "vitest";
import { seedData } from "../../src/lib/seed";
import type { WorkspaceData } from "../../src/lib/types";
import {
  findCaseByTrackingCode,
  findClientByIdentifier,
  getCaseDocuments,
  getClientActiveCases,
  getFirmGuidePageModel,
  getFirmPublicSiteModel,
  getFirmWorkQueue,
  getCaseMilestones,
  getCaseUpdates,
  getCurrentMilestone,
  resolvePublicAccess,
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

  test("resolves public access by case code, client email or phone", () => {
    const workspace = cloneWorkspace();

    expect(resolvePublicAccess(workspace, "as-2026-001")?.kind).toBe("case");
    expect(resolvePublicAccess(workspace, "laura@constructoranorte.co")?.kind).toBe("client");
    expect(resolvePublicAccess(workspace, "300 123 4567")?.kind).toBe("client");
    expect(findClientByIdentifier(workspace, "client-1")?.name).toBe(
      "Constructora Norte S.A.S.",
    );
    expect(resolvePublicAccess(workspace, "sin-coincidencia")).toBeNull();
  });

  test("returns only active cases for a client ordered by recent activity", () => {
    const workspace = cloneWorkspace();
    workspace.cases.push({
      id: "case-closed",
      clientId: "client-1",
      trackingCode: "AS-2026-099",
      title: "Asunto cerrado",
      description: "No debe aparecer como activo.",
      status: "finalizado",
      priority: "normal",
      responsible: "Daniela Torres",
      nextStep: "Archivado.",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-09T10:00:00.000Z",
    });

    const activeCases = getClientActiveCases(workspace, "client-1");

    expect(activeCases.map((legalCase) => legalCase.id)).toEqual(["case-1", "case-2"]);
    expect(activeCases.map((legalCase) => legalCase.id)).not.toContain("case-closed");
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

  test("builds a firm work queue from requests, client actions and active milestones", () => {
    const workspace = cloneWorkspace();
    workspace.requests.push({
      id: "request-closed",
      caseId: "case-1",
      title: "Solicitud cerrada",
      detail: "No debe aparecer.",
      owner: "Laura Mejia",
      dueDate: "2026-07-06",
      status: "aceptada",
      createdAt: "2026-07-05T10:00:00.000Z",
    });

    const queue = getFirmWorkQueue(workspace, "2026-07-07");

    expect(queue.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "case-case-1",
        "request-request-1",
        "request-request-2",
        "milestone-milestone-3",
        "milestone-milestone-7",
        "milestone-milestone-8",
        "milestone-milestone-9",
      ]),
    );
    expect(queue.map((item) => item.id)).not.toContain("request-request-closed");
    expect(queue[0]?.severity).toBe("high");
    expect(queue.find((item) => item.id === "case-case-1")?.clientName).toBe(
      "Constructora Norte S.A.S.",
    );
  });

  test("composes the public firm site from related published content", () => {
    const workspace = cloneWorkspace();
    workspace.guides.push({
      id: "guide-other-firm",
      firmId: "firm-other",
      practiceAreaId: "area-empresa",
      slug: "otra-firma",
      title: "Otra firma",
      summary: "No debe aparecer.",
      content: "No debe aparecer.",
      readingMinutes: 1,
      status: "published",
      sortOrder: 1,
      publishedAt: "2026-07-08T09:00:00.000Z",
    });
    workspace.caseStudies.push({
      id: "case-study-broken-area",
      firmId: "firm-demo",
      practiceAreaId: "area-inexistente",
      slug: "area-inexistente",
      title: "Area inexistente",
      scenario: "No debe aparecer.",
      approach: "No debe aparecer.",
      outcomeSummary: "No debe aparecer.",
      disclaimer: "No debe aparecer.",
      sortOrder: 1,
    });

    const model = getFirmPublicSiteModel(workspace, "firm-demo");

    expect(model?.firm.name).toBe("Asuntia Insolvencia");
    expect(model?.site.status).toBe("published");
    expect(model?.practiceAreas.map((area) => area.slug)).toEqual([
      "persona-natural",
      "empresa",
      "acreedores",
      "liquidacion",
    ]);
    expect(model?.guides.map((guide) => guide.slug)).toEqual([
      "documentos-antes-de-insolvencia",
      "reorganizacion-vs-liquidacion",
      "negociacion-deudas-persona-natural",
      "acreedor-en-insolvencia",
    ]);
    expect(model?.guides.map((guide) => guide.slug)).not.toContain("borrador-interno");
    expect(model?.guides.map((guide) => guide.slug)).not.toContain("otra-firma");
    expect(model?.caseStudies.map((caseStudy) => caseStudy.slug)).not.toContain(
      "area-inexistente",
    );
  });

  test("resolves guide pages by published slug and keeps related guides inside the same firm", () => {
    const workspace = cloneWorkspace();
    workspace.guides.push({
      id: "guide-related-extra",
      firmId: "firm-demo",
      practiceAreaId: "area-empresa",
      slug: "flujo-caja-reorganizacion",
      title: "Flujo de caja para reorganizacion",
      summary: "Relacionado por area.",
      content: "Relacionado por area.",
      readingMinutes: 3,
      status: "published",
      sortOrder: 15,
      publishedAt: "2026-07-08T09:00:00.000Z",
    });

    const guide = getFirmGuidePageModel(
      workspace,
      "firm-demo",
      "documentos-antes-de-insolvencia",
    );
    const draft = getFirmGuidePageModel(workspace, "firm-demo", "borrador-interno");
    const missing = getFirmGuidePageModel(workspace, "firm-demo", "no-existe");

    expect(guide?.guide.title).toBe("Preparar documentos antes de iniciar una insolvencia");
    expect(guide?.practiceArea?.id).toBe("area-empresa");
    expect(guide?.relatedGuides.map((item) => item.slug)).toEqual([
      "flujo-caja-reorganizacion",
    ]);
    expect(guide?.relatedGuides.every((item) => item.firmId === "firm-demo")).toBe(true);
    expect(draft).toBeNull();
    expect(missing).toBeNull();
  });

  test("keeps public marketing examples separate from real legal cases", () => {
    const workspace = cloneWorkspace();
    const legalCaseIds = new Set(workspace.cases.map((legalCase) => legalCase.id));
    const guideSlugs = workspace.guides.map((guide) => `${guide.firmId}/${guide.slug}`);
    const caseStudySlugs = workspace.caseStudies.map(
      (caseStudy) => `${caseStudy.firmId}/${caseStudy.slug}`,
    );

    expect(new Set(guideSlugs).size).toBe(guideSlugs.length);
    expect(new Set(caseStudySlugs).size).toBe(caseStudySlugs.length);
    expect(workspace.caseStudies.every((caseStudy) => !legalCaseIds.has(caseStudy.id))).toBe(true);
    expect(workspace.caseStudies.every((caseStudy) => caseStudy.disclaimer.length > 0)).toBe(
      true,
    );
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
