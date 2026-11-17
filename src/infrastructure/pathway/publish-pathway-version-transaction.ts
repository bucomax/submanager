import type { Prisma } from "@prisma/client";

import { diffChecklistItems } from "@/infrastructure/pathway/checklist-diff";
import type { deriveStagesFromGraph } from "@/domain/pathway/graph-normalizer";

export type DerivedPathwayStage = ReturnType<typeof deriveStagesFromGraph>[number];

export type PublishTransactionResult =
  | { ok: true }
  | {
      ok: false;
      code: "ALREADY_PUBLISHED" | "REMOVED_STAGES_WITH_PATIENTS" | "STAGE_KEY_CONFLICT";
      stages?: { stageKey: string; name: string; patientCount: number }[];
    };

const STAGE_HISTORY_COUNT = { currentPatients: true, transitionsTo: true, transitionsFrom: true } as const;

/**
 * Corpo persistido da publicação de uma versão de pathway (stages, checklist, docs, migração de pacientes).
 * Deve ser executado dentro de `prisma.$transaction`.
 *
 * - Serializa publicações do mesmo pathway via advisory lock.
 * - Etapas removidas permanecem na versão anterior (preserva StageTransition/ChannelDispatch).
 * - Checklist é reconciliado por diff (preserva progresso dos pacientes).
 */
export async function runPublishPathwayVersionTransaction(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    pathwayId: string;
    versionId: string;
    stages: DerivedPathwayStage[];
  },
): Promise<PublishTransactionResult> {
  const { tenantId, pathwayId, versionId, stages } = input;
  const newStageKeys = new Set(stages.map((s) => s.stageKey));

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pathwayId}))`;

  const target = await tx.pathwayVersion.findFirst({
    where: { id: versionId, pathwayId },
    select: { published: true },
  });
  if (target?.published) return { ok: false, code: "ALREADY_PUBLISHED" };

  const oldPublished = await tx.pathwayVersion.findFirst({
    where: { pathwayId, published: true, NOT: { id: versionId } },
    include: { stages: { include: { _count: { select: STAGE_HISTORY_COUNT } } } },
  });
  const oldStages = oldPublished?.stages ?? [];
  const oldStagesByKey = new Map(oldStages.map((s) => [s.stageKey, s]));

  const removedWithPatients = oldStages.filter(
    (s) => !newStageKeys.has(s.stageKey) && s._count.currentPatients > 0,
  );
  if (removedWithPatients.length > 0) {
    return {
      ok: false,
      code: "REMOVED_STAGES_WITH_PATIENTS",
      stages: removedWithPatients.map((s) => ({
        stageKey: s.stageKey,
        name: s.name,
        patientCount: s._count.currentPatients,
      })),
    };
  }

  // Etapas já presentes na versão alvo (ex.: republicação de versão antiga).
  const ownStages = await tx.pathwayStage.findMany({
    where: { pathwayVersionId: versionId },
    include: { _count: { select: STAGE_HISTORY_COUNT } },
  });
  const reusableOwn = new Map<string, string>();
  for (const own of ownStages) {
    const hasHistory =
      own._count.currentPatients + own._count.transitionsTo + own._count.transitionsFrom > 0;
    const keyClashesWithOld = oldStagesByKey.has(own.stageKey);
    if (newStageKeys.has(own.stageKey) && !keyClashesWithOld) {
      reusableOwn.set(own.stageKey, own.id);
    } else if (!hasHistory) {
      await tx.pathwayStage.delete({ where: { id: own.id } });
    } else if (newStageKeys.has(own.stageKey) || !oldPublished || keyClashesWithOld) {
      return { ok: false, code: "STAGE_KEY_CONFLICT" };
    } else {
      await tx.pathwayStage.update({
        where: { id: own.id },
        data: { pathwayVersionId: oldPublished.id },
      });
    }
  }

  await tx.pathwayVersion.updateMany({
    where: { pathwayId, NOT: { id: versionId } },
    data: { published: false },
  });
  await tx.pathwayVersion.update({
    where: { id: versionId },
    data: { published: true },
  });

  for (const stage of stages) {
    const existingId = oldStagesByKey.get(stage.stageKey)?.id ?? reusableOwn.get(stage.stageKey);
    const data = {
      name: stage.name,
      sortOrder: stage.sortOrder,
      patientMessage: stage.patientMessage,
      alertWarningDays: stage.alertWarningDays,
      alertCriticalDays: stage.alertCriticalDays,
      defaultAssigneeUserId: stage.defaultAssigneeUserId,
      defaultAssigneeUserIds: stage.defaultAssigneeUserIds,
    };
    if (existingId) {
      await tx.pathwayStage.update({
        where: { id: existingId },
        data: { ...data, pathwayVersionId: versionId },
      });
    } else {
      await tx.pathwayStage.create({
        data: { ...data, pathwayVersionId: versionId, stageKey: stage.stageKey },
      });
    }
  }

  const allStages = await tx.pathwayStage.findMany({
    where: { pathwayVersionId: versionId },
    select: { id: true, stageKey: true },
  });
  const stageIdByKey = new Map(allStages.map((s) => [s.stageKey, s.id]));

  for (const stage of stages) {
    const pathwayStageId = stageIdByKey.get(stage.stageKey);
    if (!pathwayStageId) continue;
    const existingItems = await tx.pathwayStageChecklistItem.findMany({
      where: { pathwayStageId },
      select: { id: true, label: true, sortOrder: true },
    });
    const diff = diffChecklistItems(existingItems, stage.checklistItems);
    for (const { id, ...itemData } of diff.update) {
      await tx.pathwayStageChecklistItem.update({ where: { id }, data: itemData });
    }
    if (diff.create.length > 0) {
      await tx.pathwayStageChecklistItem.createMany({
        data: diff.create.map((item) => ({ pathwayStageId, ...item })),
      });
    }
    if (diff.deleteIds.length > 0) {
      await tx.pathwayStageChecklistItem.deleteMany({ where: { id: { in: diff.deleteIds } } });
    }
  }

  const requestedFileIds = [...new Set(stages.flatMap((stage) => stage.documentFileAssetIds))];
  const validFiles =
    requestedFileIds.length > 0
      ? await tx.fileAsset.findMany({
          where: { id: { in: requestedFileIds }, tenantId },
          select: { id: true },
        })
      : [];
  const validFileIds = new Set(validFiles.map((f) => f.id));

  const stageIdsToReset = stages
    .map((stage) => stageIdByKey.get(stage.stageKey))
    .filter((id): id is string => Boolean(id));
  if (stageIdsToReset.length > 0) {
    await tx.stageDocument.deleteMany({ where: { pathwayStageId: { in: stageIdsToReset } } });
  }

  const documentRows = stages.flatMap((stage) => {
    const pathwayStageId = stageIdByKey.get(stage.stageKey);
    if (!pathwayStageId) return [];
    const orderedValidIds = [...new Set(stage.documentFileAssetIds)].filter((id) => validFileIds.has(id));
    return orderedValidIds.map((fileAssetId, sortOrder) => ({ pathwayStageId, fileAssetId, sortOrder }));
  });
  if (documentRows.length > 0) {
    await tx.stageDocument.createMany({ data: documentRows });
  }

  if (oldPublished) {
    await tx.patientPathway.updateMany({
      where: { pathwayVersionId: oldPublished.id },
      data: { pathwayVersionId: versionId },
    });
  }

  return { ok: true };
}
