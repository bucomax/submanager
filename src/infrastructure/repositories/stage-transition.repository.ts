import type { Prisma } from "@prisma/client";

import type {
  ClaimStageParams,
  CreateStageTransitionRecord,
  IStageTransitionStore,
  IStageTransitionTx,
} from "@/application/ports/stage-transition.port";
import { prisma } from "@/infrastructure/database/prisma";
import { createPrismaAuditRecorder } from "@/infrastructure/repositories/audit-recorder.repository";
import { pathwayChecklistPrismaRepository } from "@/infrastructure/repositories/pathway-checklist.repository";
import { getStageDocumentBundleFrom } from "@/infrastructure/repositories/stage-document-bundle.query";
import { pickFirstTenantMemberFrom } from "@/infrastructure/repositories/tenant-member-picker.query";

const VIEW_INCLUDE = {
  currentStage: true,
  currentStageAssignee: { select: { id: true, name: true, email: true } },
} satisfies Prisma.PatientPathwayInclude;

/** Repositórios participando de uma `Prisma.TransactionClient`. */
function createTx(tx: Prisma.TransactionClient): IStageTransitionTx {
  return {
    audit: createPrismaAuditRecorder(tx),

    async findPatientPathwayState(tenantId, patientPathwayId) {
      const row = await tx.patientPathway.findFirst({
        where: { id: patientPathwayId, tenantId },
        select: {
          currentStageId: true,
          pathwayVersionId: true,
          completedAt: true,
          currentStage: { select: { name: true } },
        },
      });
      if (!row) return null;
      return {
        currentStageId: row.currentStageId,
        pathwayVersionId: row.pathwayVersionId,
        completedAt: row.completedAt,
        currentStageName: row.currentStage?.name ?? null,
      };
    },

    listPendingRequiredChecklistItems: (patientPathwayId, stageId) =>
      pathwayChecklistPrismaRepository.listPendingRequiredForTransition(tx, patientPathwayId, stageId),

    getStageDocumentBundle: (stageId) => getStageDocumentBundleFrom(tx, stageId),

    pickFirstTenantMember: (tenantId, candidateUserIds) =>
      pickFirstTenantMemberFrom(tx, tenantId, candidateUserIds),

    async claimStage(p: ClaimStageParams) {
      const claimed = await tx.patientPathway.updateMany({
        where: {
          id: p.patientPathwayId,
          tenantId: p.tenantId,
          currentStageId: p.fromStageId,
          completedAt: null,
        },
        data: {
          currentStageId: p.toStageId,
          enteredStageAt: p.enteredStageAt,
          currentStageAssigneeUserId: p.assigneeUserId,
        },
      });
      return claimed.count > 0;
    },

    createStageTransition: (record: CreateStageTransitionRecord) =>
      tx.stageTransition.create({
        data: { ...record, dispatchStub: record.dispatchStub as Prisma.InputJsonValue },
        select: { id: true },
      }),

    loadPatientPathwayView: (patientPathwayId) =>
      tx.patientPathway.findUniqueOrThrow({ where: { id: patientPathwayId }, include: VIEW_INCLUDE }),

    findTransitionByCorrelation: (patientPathwayId, correlationId) =>
      tx.stageTransition.findUnique({
        where: { patientPathwayId_correlationId: { patientPathwayId, correlationId } },
        select: { toStageId: true },
      }),
  };
}

export const stageTransitionPrismaStore: IStageTransitionStore = {
  findPatientPathwayForTransition: (tenantId, patientPathwayId) =>
    prisma.patientPathway.findFirst({
      where: { id: patientPathwayId, tenantId },
      select: {
        id: true,
        clientId: true,
        pathwayVersionId: true,
        currentStageId: true,
        completedAt: true,
        client: {
          select: { id: true, name: true, email: true, phone: true, assignedToUserId: true },
        },
      },
    }),

  findStageInVersion: (pathwayVersionId, stageId) =>
    prisma.pathwayStage.findFirst({
      where: { id: stageId, pathwayVersionId },
      select: {
        id: true,
        name: true,
        patientMessage: true,
        defaultAssigneeUserIds: true,
        defaultAssigneeUserId: true,
      },
    }),

  runInTransaction: (fn) => prisma.$transaction((tx) => fn(createTx(tx))),
};
