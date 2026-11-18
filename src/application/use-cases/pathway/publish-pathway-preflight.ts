import type { IPublishPreflightReader } from "@/application/ports/pathway-publish.port";
import { deriveStagesFromGraph } from "@/domain/pathway/graph-normalizer";
import { analyzeStageRemoval } from "@/domain/pathway/stage-removal";

export type PathwayPublishPreflightIssue = {
  code: "GRAPH_EMPTY" | "INVALID_ASSIGNEES" | "REMOVED_STAGES_WITH_PATIENTS";
  message: string;
  stages?: { stageKey: string; name: string; patientCount: number }[];
};

export type PublishedStagePatientCountRow = {
  stageKey: string;
  name: string;
  patientCount: number;
};

export type PathwayPublishPreflightResult = {
  canPublish: boolean;
  issues: PathwayPublishPreflightIssue[];
  publishedStagePatientCounts: PublishedStagePatientCountRow[];
  proposedStageKeys: string[];
  removedStageKeys: string[];
  removedStagesWithPatients: PublishedStagePatientCountRow[];
  removedStagesWithoutPatients: { stageKey: string; name: string }[];
};

type ApiT = (key: string, params?: Record<string, string>) => string;

async function allAssigneesBelongToTenant(
  reader: IPublishPreflightReader,
  tenantId: string,
  assigneeUserIds: string[],
): Promise<boolean> {
  const unique = [...new Set(assigneeUserIds.filter((id) => id.length > 0))];
  if (unique.length === 0) return true;
  const members = new Set(await reader.findTenantMemberUserIds(tenantId, unique));
  return unique.every((id) => members.has(id));
}

/**
 * Validação compartilhada entre `POST …/publish` e `POST …/publish-preview`.
 * Não grava no banco.
 */
export async function runPathwayPublishPreflight(
  params: {
    tenantId: string;
    pathwayId: string;
    versionId: string;
    graphJson: unknown;
    apiT: ApiT;
  },
  reader: IPublishPreflightReader,
): Promise<PathwayPublishPreflightResult> {
  const { tenantId, pathwayId, versionId, graphJson, apiT } = params;
  const stages = deriveStagesFromGraph(graphJson);
  const issues: PathwayPublishPreflightIssue[] = [];

  const newStageKeys = new Set(stages.map((s) => s.stageKey));
  const oldPublished = await reader.findOtherPublishedVersion(pathwayId, versionId);
  const oldStages = oldPublished?.stages ?? [];

  const publishedStagePatientCounts: PublishedStagePatientCountRow[] = oldStages.map((s) => ({
    stageKey: s.stageKey,
    name: s.name,
    patientCount: s.currentPatients,
  }));
  const { removedStageKeys, removedWithPatients, removedWithoutPatients } = analyzeStageRemoval(
    oldStages,
    newStageKeys,
  );
  const removedStagesWithPatients: PublishedStagePatientCountRow[] = removedWithPatients.map((s) => ({
    stageKey: s.stageKey,
    name: s.name,
    patientCount: s.currentPatients,
  }));

  if (stages.length === 0) {
    issues.push({ code: "GRAPH_EMPTY", message: apiT("errors.graphNeedsAtLeastOneNode") });
  }

  const assigneesOk = await allAssigneesBelongToTenant(
    reader,
    tenantId,
    stages.flatMap((s) => s.defaultAssigneeUserIds),
  );
  if (!assigneesOk) {
    issues.push({ code: "INVALID_ASSIGNEES", message: apiT("errors.invalidAssigneeForTenant") });
  }

  if (removedStagesWithPatients.length > 0) {
    const names = removedStagesWithPatients.map((s) => s.name).join(", ");
    issues.push({
      code: "REMOVED_STAGES_WITH_PATIENTS",
      message: apiT("errors.stagesHavePatients", { stages: names }),
      stages: removedStagesWithPatients,
    });
  }

  return {
    canPublish: issues.length === 0,
    issues,
    publishedStagePatientCounts,
    proposedStageKeys: [...newStageKeys],
    removedStageKeys,
    removedStagesWithPatients,
    removedStagesWithoutPatients: removedWithoutPatients.map((s) => ({
      stageKey: s.stageKey,
      name: s.name,
    })),
  };
}

export function firstPreflightHttpError(issues: PathwayPublishPreflightIssue[]): {
  status: number;
  errorCode: string;
  message: string;
  details?: { stages: PathwayPublishPreflightIssue["stages"] };
} | null {
  const first = issues[0];
  if (!first) return null;
  if (first.code === "REMOVED_STAGES_WITH_PATIENTS") {
    return {
      status: 409,
      errorCode: "CONFLICT",
      message: first.message,
      ...(first.stages ? { details: { stages: first.stages } } : {}),
    };
  }
  return {
    status: 422,
    errorCode: "VALIDATION_ERROR",
    message: first.message,
  };
}
