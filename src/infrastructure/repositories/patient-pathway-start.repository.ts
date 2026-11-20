import type { Prisma } from "@prisma/client";

import type {
  IPatientPathwayStartStore,
  IPatientPathwayStartTx,
} from "@/application/ports/patient-pathway-start.port";
import { prisma } from "@/infrastructure/database/prisma";
import { createPrismaAuditRecorder } from "@/infrastructure/repositories/audit-recorder.repository";
import { acquirePathwaySharedLock } from "@/infrastructure/repositories/pathway-advisory-lock";
import { getStageDocumentBundleFrom } from "@/infrastructure/repositories/stage-document-bundle.query";
import { pickFirstTenantMemberFrom } from "@/infrastructure/repositories/tenant-member-picker.query";

function createTx(tx: Prisma.TransactionClient): IPatientPathwayStartTx {
  return {
    audit: createPrismaAuditRecorder(tx),

    async lockClient(clientId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`patient-pathway:${clientId}`}))`;
    },

    lockPathway: (pathwayId) => acquirePathwaySharedLock(tx, pathwayId),

    findPublishedVersionWithFirstStage: (pathwayId) =>
      tx.pathwayVersion.findFirst({
        where: { pathwayId, published: true },
        orderBy: { version: "desc" },
        include: { stages: { orderBy: { sortOrder: "asc" }, take: 1 } },
      }),

    async hasActivePatientPathway(clientId) {
      const row = await tx.patientPathway.findFirst({
        where: { clientId, completedAt: null },
        select: { id: true },
      });
      return row != null;
    },

    pickFirstTenantMember: (tenantId, candidateUserIds) =>
      pickFirstTenantMemberFrom(tx, tenantId, candidateUserIds),

    getStageDocumentBundle: (stageId) => getStageDocumentBundleFrom(tx, stageId),

    createPatientPathway: (record) =>
      tx.patientPathway.create({
        data: record,
        include: {
          currentStage: true,
          pathway: { select: { id: true, name: true } },
          client: { select: { id: true, name: true, phone: true } },
          currentStageAssignee: { select: { id: true, name: true, email: true } },
        },
      }),

    createInitialTransition: ({ patientPathwayId, toStageId, actorUserId, dispatchStub }) =>
      tx.stageTransition.create({
        data: {
          patientPathwayId,
          fromStageId: null,
          toStageId,
          actorUserId,
          dispatchStub: dispatchStub as Prisma.InputJsonValue,
        },
        select: { id: true },
      }),
  };
}

export const patientPathwayStartPrismaStore: IPatientPathwayStartStore = {
  findActivePatientPathwayId: (clientId) =>
    prisma.patientPathway.findFirst({
      where: { clientId, completedAt: null },
      select: { id: true },
    }),

  findCarePathwayId: (tenantId, pathwayId) =>
    prisma.carePathway.findFirst({ where: { id: pathwayId, tenantId }, select: { id: true } }),

  runInTransaction: (fn) => prisma.$transaction((tx) => fn(createTx(tx))),
};
