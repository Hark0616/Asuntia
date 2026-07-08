import { describe, expect, test } from "vitest";
import type { CaseMilestone } from "../../src/lib/types";
import { insertCaseMilestone, updateCaseMilestone } from "../../src/lib/workspace-mutators";

const milestones: CaseMilestone[] = [
  {
    id: "milestone-1",
    caseId: "case-1",
    title: "Apertura",
    description: "Apertura del asunto.",
    detail: "Detalle.",
    date: "2026-07-01",
    status: "completed",
    evidenceEnabled: false,
  },
  {
    id: "milestone-2",
    caseId: "case-1",
    title: "Revision",
    description: "Revision actual.",
    detail: "Detalle.",
    date: "2026-07-03",
    status: "current",
    evidenceEnabled: false,
  },
  {
    id: "milestone-other",
    caseId: "case-2",
    title: "Otro caso",
    description: "No debe cambiar.",
    detail: "Detalle.",
    date: "2026-07-04",
    status: "current",
    evidenceEnabled: false,
  },
];

describe("workspace milestone mutators", () => {
  test("moves the previous current milestone to completed when inserting a new current one", () => {
    const next = insertCaseMilestone(milestones, {
      id: "milestone-3",
      caseId: "case-1",
      title: "Radicacion",
      description: "Nuevo hito actual.",
      detail: "Detalle nuevo.",
      date: "2026-07-06",
      status: "current",
      evidenceEnabled: true,
    });

    expect(next.filter((milestone) => milestone.caseId === "case-1" && milestone.status === "current")).toHaveLength(1);
    expect(next.find((milestone) => milestone.id === "milestone-2")?.status).toBe("completed");
    expect(next.find((milestone) => milestone.id === "milestone-3")?.evidenceEnabled).toBe(true);
    expect(next.find((milestone) => milestone.id === "milestone-other")?.status).toBe("current");
  });

  test("normalizes duplicated current milestones when an existing milestone becomes current", () => {
    const next = updateCaseMilestone(milestones, "case-1", "milestone-1", {
      status: "current",
    });

    expect(next.filter((milestone) => milestone.caseId === "case-1" && milestone.status === "current")).toHaveLength(1);
    expect(next.find((milestone) => milestone.id === "milestone-1")?.status).toBe("current");
    expect(next.find((milestone) => milestone.id === "milestone-2")?.status).toBe("completed");
  });

  test("updates non-status milestone fields without changing the current marker", () => {
    const next = updateCaseMilestone(milestones, "case-1", "milestone-2", {
      evidenceEnabled: true,
    });

    expect(next.find((milestone) => milestone.id === "milestone-2")?.status).toBe("current");
    expect(next.find((milestone) => milestone.id === "milestone-2")?.evidenceEnabled).toBe(true);
  });
});
