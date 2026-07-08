import type { CaseMilestone } from "./types";

export function insertCaseMilestone(
  milestones: CaseMilestone[],
  milestone: CaseMilestone,
) {
  const normalizedMilestones =
    milestone.status === "current"
      ? milestones.map((item) =>
          item.caseId === milestone.caseId && item.status === "current"
            ? { ...item, status: "completed" as const }
            : item,
        )
      : milestones;

  return [...normalizedMilestones, milestone];
}

export function updateCaseMilestone(
  milestones: CaseMilestone[],
  caseId: string,
  milestoneId: string,
  patch: Partial<CaseMilestone>,
) {
  return milestones.map((milestone) => {
    if (milestone.caseId !== caseId) {
      return milestone;
    }

    if (milestone.id === milestoneId) {
      return { ...milestone, ...patch };
    }

    if (patch.status === "current" && milestone.status === "current") {
      return { ...milestone, status: "completed" as const };
    }

    return milestone;
  });
}
