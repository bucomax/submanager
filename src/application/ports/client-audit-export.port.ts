import type { Prisma } from "@prisma/client";

export type StageTransitionTimelineRow = Prisma.StageTransitionGetPayload<{
  include: {
    fromStage: { select: { id: true; name: true; stageKey: true } };
    toStage: { select: { id: true; name: true; stageKey: true } };
    actor: { select: { id: true; name: true; email: true } };
    forcedByUser: { select: { id: true; name: true; email: true } };
  };
}>;

export type ClientAuditExportSources = {
  audits: Prisma.AuditEventGetPayload<{
    include: { actor: { select: { id: true; name: true; email: true } } };
  }>[];
  transitions: StageTransitionTimelineRow[];
};
