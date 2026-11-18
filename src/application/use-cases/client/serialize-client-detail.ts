import {
  type ClientDetailPatientPathwayRow,
  MAX_COMPLETED_TRANSITIONS,
  clientDetailPatientPathwaySelect,
} from "@/infrastructure/repositories/client-query-shapes";
import { buildPagination } from "@/lib/api/pagination";
import { computeSlaHealthStatus } from "@/domain/pathway/sla-health";
import type {
  ClientCompletedTreatmentDto,
  ClientDetailStageDto,
  ClientDetailTransitionDto,
  ClientPatientPathwayDetailDto,
  PatientPathwayAssigneeOverviewDto,
  StageAssigneeSummaryDto,
} from "@/types/api/clients-v1";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function collectPathwayStageDefaultAssigneeUserIds(pp: ClientDetailPatientPathwayRow): string[] {
  const set = new Set<string>();
  for (const s of pp.pathwayVersion.stages) {
    for (const id of s.defaultAssigneeUserIds) {
      set.add(id);
    }
  }
  return [...set];
}

function mapStageDefaultAssignees(
  userIds: string[],
  byId: ReadonlyMap<string, StageAssigneeSummaryDto>,
): StageAssigneeSummaryDto[] {
  const out: StageAssigneeSummaryDto[] = [];
  for (const id of userIds) {
    const u = byId.get(id);
    if (u) out.push(u);
  }
  return out;
}

export function buildStagesPayload(
  pp: ClientDetailPatientPathwayRow,
  assigneeByUserId: ReadonlyMap<string, StageAssigneeSummaryDto>,
): ClientDetailStageDto[] {
  const checklistProgressByItemId = new Map(
    pp.checklistItems.map((item) => [item.checklistItemId, item.completedAt]),
  );

  return pp.pathwayVersion.stages.map((s) => ({
    id: s.id,
    name: s.name,
    stageKey: s.stageKey,
    sortOrder: s.sortOrder,
    patientMessage: s.patientMessage ?? null,
    alertWarningDays: s.alertWarningDays,
    alertCriticalDays: s.alertCriticalDays,
    defaultAssigneeUserId: s.defaultAssigneeUserId,
    defaultAssigneeUserIds: [...s.defaultAssigneeUserIds],
    defaultAssignees: mapStageDefaultAssignees(s.defaultAssigneeUserIds, assigneeByUserId),
    documents: s.stageDocuments.map((sd) => ({
      id: sd.id,
      sortOrder: sd.sortOrder,
      file: {
        id: sd.fileAsset.id,
        fileName: sd.fileAsset.fileName,
        mimeType: sd.fileAsset.mimeType,
      },
    })),
    checklistItems: s.checklistItems.map((item) => {
      const completedAt = checklistProgressByItemId.get(item.id) ?? null;
      return {
        id: item.id,
        label: item.label,
        sortOrder: item.sortOrder,
        requiredForTransition: item.requiredForTransition,
        completed: completedAt != null,
        completedAt: completedAt?.toISOString() ?? null,
      };
    }),
  }));
}

export type ClientDetailStageTransitionRow = {
  id: string;
  note: string | null;
  ruleOverrideReason: string | null;
  createdAt: Date;
  fromStage: { id: string; name: string; stageKey: string } | null;
  toStage: { id: string; name: string; stageKey: string };
  actor: { id: string; name: string | null; email: string };
  forcedByUser: { id: string; name: string | null; email: string } | null;
};

export function mapTransitionRow(tr: ClientDetailStageTransitionRow): ClientDetailTransitionDto {
  return {
    id: tr.id,
    fromStage: tr.fromStage,
    toStage: tr.toStage,
    note: tr.note,
    ruleOverrideReason: tr.ruleOverrideReason,
    forcedBy: tr.forcedByUser
      ? {
          id: tr.forcedByUser.id,
          name: tr.forcedByUser.name,
          email: tr.forcedByUser.email,
        }
      : null,
    actor: {
      id: tr.actor.id,
      name: tr.actor.name,
      email: tr.actor.email,
    },
    createdAt: tr.createdAt.toISOString(),
  };
}

function buildAssigneeOverview(
  pp: ClientDetailPatientPathwayRow,
  entryTransition: ClientDetailStageTransitionRow | null,
  assigneeByUserId: ReadonlyMap<string, StageAssigneeSummaryDto>,
): PatientPathwayAssigneeOverviewDto {
  const cs = pp.currentStage;
  if (!cs) {
    return {
      enteredCurrentStageFrom: null,
      lastTransitionActor: null,
      followingStages: [],
    };
  }

  const enteredCurrentStageFrom = entryTransition?.fromStage
    ? {
        id: entryTransition.fromStage.id,
        name: entryTransition.fromStage.name,
        stageKey: entryTransition.fromStage.stageKey,
      }
    : null;

  const lastTransitionActor = entryTransition?.actor
    ? {
        id: entryTransition.actor.id,
        name: entryTransition.actor.name,
        email: entryTransition.actor.email,
      }
    : null;

  const followingStages = pp.pathwayVersion.stages
    .filter((s) => s.sortOrder > cs.sortOrder)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s) => {
      const multi = mapStageDefaultAssignees(s.defaultAssigneeUserIds, assigneeByUserId);
      const legacy =
        s.defaultAssigneeUser != null
          ? {
              id: s.defaultAssigneeUser.id,
              name: s.defaultAssigneeUser.name,
              email: s.defaultAssigneeUser.email,
            }
          : null;
      return {
        id: s.id,
        name: s.name,
        stageKey: s.stageKey,
        sortOrder: s.sortOrder,
        defaultAssigneeUserId: s.defaultAssigneeUserId,
        defaultAssigneeUserIds: [...s.defaultAssigneeUserIds],
        defaultAssignee: multi[0] ?? legacy,
        defaultAssignees: multi.length > 0 ? multi : legacy ? [legacy] : [],
      };
    });

  return { enteredCurrentStageFrom, lastTransitionActor, followingStages };
}

export function serializeActivePatientPathwayDetail(
  pp: ClientDetailPatientPathwayRow,
  args: {
    now: Date;
    transitionRows: ClientDetailStageTransitionRow[];
    totalTransitions: number;
    page: number;
    limit: number;
    entryToCurrentStageTransition: ClientDetailStageTransitionRow | null;
    assigneeByUserId: ReadonlyMap<string, StageAssigneeSummaryDto>;
  },
): ClientPatientPathwayDetailDto {
  const stagesPayload = buildStagesPayload(pp, args.assigneeByUserId);
  const cs = pp.currentStage;
  const journeyCompleted = pp.completedAt != null;
  const daysInStage = journeyCompleted
    ? 0
    : Math.floor((args.now.getTime() - pp.enteredStageAt.getTime()) / MS_PER_DAY);
  const slaStatus = journeyCompleted
    ? ("ok" as const)
    : computeSlaHealthStatus(
        pp.enteredStageAt,
        args.now,
        cs?.alertWarningDays,
        cs?.alertCriticalDays,
      );

  return {
    id: pp.id,
    completedAt: pp.completedAt?.toISOString() ?? null,
    pathway: pp.pathway,
    pathwayVersion: {
      id: pp.pathwayVersion.id,
      version: pp.pathwayVersion.version,
      stages: stagesPayload,
    },
    currentStage: cs ? currentStageDetailDto(cs, stagesPayload) : null,
    currentStageAssignee: pp.currentStageAssignee
      ? {
          id: pp.currentStageAssignee.id,
          name: pp.currentStageAssignee.name,
          email: pp.currentStageAssignee.email,
        }
      : null,
    assigneeOverview: buildAssigneeOverview(pp, args.entryToCurrentStageTransition, args.assigneeByUserId),
    enteredStageAt: pp.enteredStageAt.toISOString(),
    daysInStage,
    slaStatus,
    transitions: {
      data: args.transitionRows.map(mapTransitionRow),
      pagination: buildPagination(args.page, args.limit, args.totalTransitions),
    },
  };
}

function currentStageDetailDto(
  cs: NonNullable<ClientDetailPatientPathwayRow["currentStage"]>,
  stagesPayload: ClientDetailStageDto[],
): ClientDetailStageDto {
  const slice = stagesPayload.find((st) => st.id === cs.id);
  return {
    id: cs.id,
    name: cs.name,
    stageKey: cs.stageKey,
    sortOrder: cs.sortOrder,
    patientMessage: cs.patientMessage,
    alertWarningDays: cs.alertWarningDays,
    alertCriticalDays: cs.alertCriticalDays,
    defaultAssigneeUserId: cs.defaultAssigneeUserId,
    defaultAssigneeUserIds: slice?.defaultAssigneeUserIds ?? [],
    defaultAssignees: slice?.defaultAssignees ?? [],
    documents: slice?.documents ?? [],
    checklistItems: slice?.checklistItems ?? [],
  };
}

export function serializeCompletedTreatment(
  pp: ClientDetailPatientPathwayRow,
  transitionRows: ClientDetailStageTransitionRow[],
  opts?: {
    transitionsTruncated?: boolean;
    assigneeByUserId?: ReadonlyMap<string, StageAssigneeSummaryDto>;
  },
): ClientCompletedTreatmentDto {
  const empty = new Map<string, StageAssigneeSummaryDto>();
  const stagesPayload = buildStagesPayload(pp, opts?.assigneeByUserId ?? empty);
  const cs = pp.currentStage;
  const completedAt = pp.completedAt!;
  return {
    id: pp.id,
    startedAt: pp.createdAt.toISOString(),
    completedAt: completedAt.toISOString(),
    pathway: pp.pathway,
    pathwayVersion: {
      id: pp.pathwayVersion.id,
      version: pp.pathwayVersion.version,
      stages: stagesPayload,
    },
    currentStage: cs ? currentStageDetailDto(cs, stagesPayload) : null,
    transitions: transitionRows.map(mapTransitionRow),
    transitionsTruncated: opts?.transitionsTruncated ?? false,
  };
}

export { MAX_COMPLETED_TRANSITIONS, clientDetailPatientPathwaySelect };
export type { ClientDetailPatientPathwayRow };
