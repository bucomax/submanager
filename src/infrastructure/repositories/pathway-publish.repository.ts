import type { Prisma } from "@prisma/client";

import type {
  IPathwayPublishStore,
  IPublishPreflightReader,
  IPublishTx,
} from "@/application/ports/pathway-publish.port";
import { prisma } from "@/infrastructure/database/prisma";

const STAGE_HISTORY_COUNT = {
  currentPatients: true,
  transitionsTo: true,
  transitionsFrom: true,
} as const;

type Db = Prisma.TransactionClient | typeof prisma;

/** Outra versão publicada do pathway, com contagem de pacientes por etapa (ordenada por `sortOrder`). */
function findOtherPublishedVersion(db: Db): IPublishPreflightReader["findOtherPublishedVersion"] {
  return async (pathwayId, excludeVersionId) => {
    const version = await db.pathwayVersion.findFirst({
      where: { pathwayId, published: true, NOT: { id: excludeVersionId } },
      include: {
        stages: {
          include: { _count: { select: { currentPatients: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!version) return null;
    return {
      id: version.id,
      stages: version.stages.map((s) => ({
        id: s.id,
        stageKey: s.stageKey,
        name: s.name,
        currentPatients: s._count.currentPatients,
      })),
    };
  };
}

function createTx(tx: Prisma.TransactionClient): IPublishTx {
  return {
    findOtherPublishedVersion: findOtherPublishedVersion(tx),

    async acquirePathwayLock(pathwayId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pathwayId}))`;
    },

    findVersionPublishedFlag: (versionId, pathwayId) =>
      tx.pathwayVersion.findFirst({
        where: { id: versionId, pathwayId },
        select: { published: true },
      }),

    async listVersionStagesWithHistory(versionId) {
      const rows = await tx.pathwayStage.findMany({
        where: { pathwayVersionId: versionId },
        include: { _count: { select: STAGE_HISTORY_COUNT } },
      });
      return rows.map((s) => ({
        id: s.id,
        stageKey: s.stageKey,
        currentPatients: s._count.currentPatients,
        transitionsTo: s._count.transitionsTo,
        transitionsFrom: s._count.transitionsFrom,
      }));
    },

    async deleteStage(stageId) {
      await tx.pathwayStage.delete({ where: { id: stageId } });
    },

    async moveStageToVersion(stageId, versionId) {
      await tx.pathwayStage.update({ where: { id: stageId }, data: { pathwayVersionId: versionId } });
    },

    async unpublishOtherVersions(pathwayId, exceptVersionId) {
      await tx.pathwayVersion.updateMany({
        where: { pathwayId, NOT: { id: exceptVersionId } },
        data: { published: false },
      });
    },

    async markVersionPublished(versionId) {
      await tx.pathwayVersion.update({ where: { id: versionId }, data: { published: true } });
    },

    async updateStage(stageId, versionId, fields) {
      await tx.pathwayStage.update({
        where: { id: stageId },
        data: { ...fields, pathwayVersionId: versionId },
      });
    },

    async createStage(versionId, stageKey, fields) {
      await tx.pathwayStage.create({ data: { ...fields, pathwayVersionId: versionId, stageKey } });
    },

    listStageKeyIds: (versionId) =>
      tx.pathwayStage.findMany({
        where: { pathwayVersionId: versionId },
        select: { id: true, stageKey: true },
      }),

    listChecklistItems: (stageId) =>
      tx.pathwayStageChecklistItem.findMany({
        where: { pathwayStageId: stageId },
        select: { id: true, label: true, sortOrder: true },
      }),

    async updateChecklistItem(itemId, data) {
      await tx.pathwayStageChecklistItem.update({ where: { id: itemId }, data });
    },

    async createChecklistItems(stageId, items) {
      await tx.pathwayStageChecklistItem.createMany({
        data: items.map((item) => ({ pathwayStageId: stageId, ...item })),
      });
    },

    async deleteChecklistItems(itemIds) {
      await tx.pathwayStageChecklistItem.deleteMany({ where: { id: { in: itemIds } } });
    },

    async findTenantFileIds(tenantId, fileAssetIds) {
      const rows = await tx.fileAsset.findMany({
        where: { id: { in: fileAssetIds }, tenantId },
        select: { id: true },
      });
      return rows.map((f) => f.id);
    },

    async deleteStageDocuments(stageIds) {
      await tx.stageDocument.deleteMany({ where: { pathwayStageId: { in: stageIds } } });
    },

    async createStageDocuments(rows) {
      await tx.stageDocument.createMany({ data: rows });
    },

    async movePatientsToVersion(fromVersionId, toVersionId) {
      await tx.patientPathway.updateMany({
        where: { pathwayVersionId: fromVersionId },
        data: { pathwayVersionId: toVersionId },
      });
    },
  };
}

export const pathwayPublishPrismaStore: IPathwayPublishStore = {
  findOtherPublishedVersion: findOtherPublishedVersion(prisma),

  async findTenantMemberUserIds(tenantId, userIds) {
    const rows = await prisma.tenantMembership.findMany({
      where: { tenantId, userId: { in: userIds } },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  },

  findCarePathwayIdForPublish: (tenantId, pathwayId) =>
    prisma.carePathway.findFirst({ where: { id: pathwayId, tenantId }, select: { id: true } }),

  findPathwayVersionForPublish: (pathwayId, versionId) =>
    prisma.pathwayVersion.findFirst({
      where: { id: versionId, pathwayId },
      select: { graphJson: true },
    }),

  findVersionWithStages: (versionId) =>
    prisma.pathwayVersion.findUnique({
      where: { id: versionId },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    }),

  runInTransaction: (fn) => prisma.$transaction((tx) => fn(createTx(tx))),
};
