import type { Prisma } from "@prisma/client";

import type {
  CreatePathwayVersionDraftResult,
  CreatePathwayVersionInput,
  IPathwayRepository,
  LinkStageDocumentResult,
} from "@/application/ports/pathway-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

export class PathwayPrismaRepository implements IPathwayRepository {
  async findById(tenantId: string, pathwayId: string) {
    return prisma.carePathway.findFirst({
      where: { id: pathwayId, tenantId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          select: {
            id: true,
            version: true,
            published: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async findVersion(tenantId: string, pathwayId: string, versionId: string) {
    return prisma.pathwayVersion.findFirst({
      where: {
        id: versionId,
        pathwayId,
        pathway: { tenantId },
      },
    });
  }

  async createVersion(input: CreatePathwayVersionInput) {
    const pathway = await prisma.carePathway.findFirst({
      where: { id: input.pathwayId, tenantId: input.tenantId },
      select: { id: true },
    });
    if (!pathway) return null;

    const latest = await prisma.pathwayVersion.findFirst({
      where: { pathwayId: input.pathwayId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const nextVersion = (latest?.version ?? 0) + 1;

    return prisma.pathwayVersion.create({
      data: {
        pathwayId: input.pathwayId,
        version: nextVersion,
        graphJson: input.graphJson as Prisma.InputJsonValue,
        published: false,
      },
    });
  }

  async updateCarePathway(
    tenantId: string,
    pathwayId: string,
    data: { name?: string; description?: string | null },
  ) {
    const existing = await prisma.carePathway.findFirst({
      where: { id: pathwayId, tenantId },
      select: { id: true },
    });
    if (!existing) return null;
    return prisma.carePathway.update({
      where: { id: pathwayId },
      data,
    });
  }

  async countPatientPathwaysForPathway(pathwayId: string) {
    return prisma.patientPathway.count({ where: { pathwayId } });
  }

  async deleteCarePathway(tenantId: string, pathwayId: string) {
    const result = await prisma.carePathway.deleteMany({
      where: { id: pathwayId, tenantId },
    });
    return result.count > 0;
  }

  async linkStageDocument(params: {
    tenantId: string;
    pathwayStageId: string;
    fileAssetId: string;
  }): Promise<LinkStageDocumentResult> {
    const { tenantId, pathwayStageId, fileAssetId } = params;

    const stage = await prisma.pathwayStage.findFirst({
      where: {
        id: pathwayStageId,
        pathwayVersion: { pathway: { tenantId }, published: true },
      },
      select: { id: true },
    });
    if (!stage) {
      return { ok: false, code: "STAGE_NOT_FOUND" };
    }

    const file = await prisma.fileAsset.findFirst({
      where: { id: fileAssetId, tenantId },
      select: { id: true },
    });
    if (!file) {
      return { ok: false, code: "FILE_NOT_FOUND" };
    }

    const existing = await prisma.stageDocument.findFirst({
      where: {
        pathwayStageId: stage.id,
        fileAssetId: file.id,
      },
      select: { id: true },
    });
    if (existing) {
      return { ok: false, code: "ALREADY_LINKED" };
    }

    const agg = await prisma.stageDocument.aggregate({
      where: { pathwayStageId: stage.id },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const created = await prisma.stageDocument.create({
      data: {
        pathwayStageId: stage.id,
        fileAssetId: file.id,
        sortOrder,
      },
      select: {
        id: true,
        sortOrder: true,
        fileAsset: { select: { id: true, fileName: true, mimeType: true } },
      },
    });

    return {
      ok: true,
      stageDocument: {
        id: created.id,
        sortOrder: created.sortOrder,
        file: created.fileAsset,
      },
    };
  }

  async createPathwayVersionDraft(params: {
    tenantId: string;
    pathwayId: string;
    graphJson: unknown;
  }): Promise<CreatePathwayVersionDraftResult> {
    const { tenantId, pathwayId, graphJson } = params;

    const pathway = await prisma.carePathway.findFirst({
      where: { id: pathwayId, tenantId },
      select: { id: true },
    });
    if (!pathway) {
      return { ok: false, code: "PATHWAY_NOT_FOUND" };
    }

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const last = await prisma.pathwayVersion.findFirst({
        where: { pathwayId },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const nextVersion = (last?.version ?? 0) + 1;

      try {
        const row = await prisma.pathwayVersion.create({
          data: {
            pathwayId,
            version: nextVersion,
            graphJson: graphJson as Prisma.InputJsonValue,
            published: false,
          },
          select: {
            id: true,
            pathwayId: true,
            version: true,
            published: true,
            createdAt: true,
          },
        });

        return {
          ok: true,
          version: {
            ...row,
            createdAt: row.createdAt.toISOString(),
          },
        };
      } catch (err) {
        const isUniqueViolation =
          err instanceof Error && "code" in err && (err as { code: string }).code === "P2002";
        if (!isUniqueViolation || attempt === MAX_RETRIES - 1) {
          throw err;
        }
      }
    }

    return { ok: false, code: "VERSION_CONFLICT" };
  }

  async createCarePathway(params: {
    tenantId: string;
    name: string;
    description?: string | null;
  }) {
    return prisma.carePathway.create({
      data: {
        tenantId: params.tenantId,
        name: params.name.trim(),
        description: params.description?.trim() || null,
      },
    });
  }

  async findCarePathwayIdForPublish(tenantId: string, pathwayId: string) {
    return prisma.carePathway.findFirst({
      where: { id: pathwayId, tenantId },
      select: { id: true },
    });
  }

  async findPathwayVersionForPublish(pathwayId: string, versionId: string) {
    return prisma.pathwayVersion.findFirst({
      where: { id: versionId, pathwayId },
    });
  }

  async runPublishTransaction(fn: (tx: unknown) => Promise<void>) {
    return prisma.$transaction(fn as (tx: Prisma.TransactionClient) => Promise<void>);
  }

  async findPathwayVersionWithStagesForPublish(versionId: string) {
    return prisma.pathwayVersion.findUnique({
      where: { id: versionId },
      include: { stages: { orderBy: { sortOrder: "asc" } } },
    });
  }

  async findPathwayStageInVersion(pathwayVersionId: string, stageId: string) {
    return prisma.pathwayStage.findFirst({
      where: { id: stageId, pathwayVersionId },
    });
  }

  async findPublishedVersionWithFirstStage(pathwayId: string) {
    return prisma.pathwayVersion.findFirst({
      where: { pathwayId, published: true },
      orderBy: { version: "desc" },
      include: {
        stages: { orderBy: { sortOrder: "asc" }, take: 1 },
      },
    });
  }
}

export const pathwayPrismaRepository = new PathwayPrismaRepository();
