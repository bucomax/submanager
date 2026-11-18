import type { IPublishTx, StageFields } from "@/application/ports/pathway-publish.port";
import { diffChecklistItems } from "@/domain/pathway/checklist-diff";
import type { deriveStagesFromGraph } from "@/domain/pathway/graph-normalizer";
import {
  analyzeStageRemoval,
  classifyOwnStage,
  type PublishedStageSnapshot,
} from "@/domain/pathway/stage-removal";

/**
 * Lançado dentro da unit of work para forçar rollback de deletes/moves já feitos;
 * o fluxo externo converte em `{ ok: false, code: "STAGE_KEY_CONFLICT" }`.
 */
export class StageKeyConflictError extends Error {
  readonly code = "STAGE_KEY_CONFLICT" as const;
  constructor() {
    super("Own stage key clashes with a published stage key");
    this.name = "StageKeyConflictError";
  }
}

export type DerivedPathwayStage = ReturnType<typeof deriveStagesFromGraph>[number];

export type PublishTransactionResult =
  | { ok: true }
  | {
      ok: false;
      code: "ALREADY_PUBLISHED" | "REMOVED_STAGES_WITH_PATIENTS" | "STAGE_KEY_CONFLICT";
      stages?: { stageKey: string; name: string; patientCount: number }[];
    };

type OwnStagesOutcome = { conflict: true } | { conflict: false; reusableByKey: Map<string, string> };

/** Etapas já presentes na versão alvo (ex.: republicação de versão antiga). */
async function reconcileOwnStages(
  tx: IPublishTx,
  input: {
    versionId: string;
    newStageKeys: ReadonlySet<string>;
    publishedVersionId: string | null;
    publishedKeys: ReadonlySet<string>;
  },
): Promise<OwnStagesOutcome> {
  const reusableByKey = new Map<string, string>();
  for (const own of await tx.listVersionStagesWithHistory(input.versionId)) {
    const action = classifyOwnStage({
      own,
      newStageKeys: input.newStageKeys,
      keyClashesWithPublished: input.publishedKeys.has(own.stageKey),
      hasPublishedVersion: input.publishedVersionId !== null,
    });
    if (action.kind === "reuse") reusableByKey.set(own.stageKey, own.id);
    else if (action.kind === "delete") await tx.deleteStage(own.id);
    else if (action.kind === "move_to_published") {
      await tx.moveStageToVersion(own.id, input.publishedVersionId!);
    } else return { conflict: true };
  }
  return { conflict: false, reusableByKey };
}

function stageFields(stage: DerivedPathwayStage): StageFields {
  return {
    name: stage.name,
    sortOrder: stage.sortOrder,
    patientMessage: stage.patientMessage,
    alertWarningDays: stage.alertWarningDays,
    alertCriticalDays: stage.alertCriticalDays,
    defaultAssigneeUserId: stage.defaultAssigneeUserId,
    defaultAssigneeUserIds: stage.defaultAssigneeUserIds,
  };
}

async function upsertStages(
  tx: IPublishTx,
  versionId: string,
  stages: DerivedPathwayStage[],
  existingIdByKey: ReadonlyMap<string, string>,
): Promise<void> {
  for (const stage of stages) {
    const existingId = existingIdByKey.get(stage.stageKey);
    if (existingId) await tx.updateStage(existingId, versionId, stageFields(stage));
    else await tx.createStage(versionId, stage.stageKey, stageFields(stage));
  }
}

/** Checklist reconciliado por diff: itens casados são atualizados no lugar (preserva progresso dos pacientes). */
async function reconcileChecklists(
  tx: IPublishTx,
  stages: DerivedPathwayStage[],
  stageIdByKey: ReadonlyMap<string, string>,
): Promise<void> {
  for (const stage of stages) {
    const pathwayStageId = stageIdByKey.get(stage.stageKey);
    if (!pathwayStageId) continue;
    const diff = diffChecklistItems(await tx.listChecklistItems(pathwayStageId), stage.checklistItems);
    for (const { id, ...itemData } of diff.update) {
      await tx.updateChecklistItem(id, itemData);
    }
    if (diff.create.length > 0) await tx.createChecklistItems(pathwayStageId, diff.create);
    if (diff.deleteIds.length > 0) await tx.deleteChecklistItems(diff.deleteIds);
  }
}

/** Documentos da etapa são recriados a partir do grafo (só arquivos do tenant, sem duplicar, em ordem). */
async function replaceStageDocuments(
  tx: IPublishTx,
  tenantId: string,
  stages: DerivedPathwayStage[],
  stageIdByKey: ReadonlyMap<string, string>,
): Promise<void> {
  const requestedFileIds = [...new Set(stages.flatMap((stage) => stage.documentFileAssetIds))];
  const validFileIds = new Set(
    requestedFileIds.length > 0 ? await tx.findTenantFileIds(tenantId, requestedFileIds) : [],
  );

  const stageIdsToReset = stages
    .map((stage) => stageIdByKey.get(stage.stageKey))
    .filter((id): id is string => Boolean(id));
  if (stageIdsToReset.length > 0) await tx.deleteStageDocuments(stageIdsToReset);

  const rows = stages.flatMap((stage) => {
    const pathwayStageId = stageIdByKey.get(stage.stageKey);
    if (!pathwayStageId) return [];
    return [...new Set(stage.documentFileAssetIds)]
      .filter((id) => validFileIds.has(id))
      .map((fileAssetId, sortOrder) => ({ pathwayStageId, fileAssetId, sortOrder }));
  });
  if (rows.length > 0) await tx.createStageDocuments(rows);
}

/**
 * Corpo persistido da publicação de uma versão de pathway (stages, checklist, docs, migração de pacientes).
 * Deve ser executado dentro de uma unit of work (`IPathwayPublishStore.runInTransaction`).
 * Conflito de stageKey lança `StageKeyConflictError` para a transação reverter (sem estado parcial).
 *
 * - Serializa publicações do mesmo pathway via lock.
 * - Etapas removidas permanecem na versão anterior (preserva StageTransition/ChannelDispatch).
 * - Checklist é reconciliado por diff (preserva progresso dos pacientes).
 */
export async function runPublishPathwayVersionTransaction(
  tx: IPublishTx,
  input: {
    tenantId: string;
    pathwayId: string;
    versionId: string;
    stages: DerivedPathwayStage[];
  },
): Promise<PublishTransactionResult> {
  const { tenantId, pathwayId, versionId, stages } = input;
  const newStageKeys = new Set(stages.map((s) => s.stageKey));

  await tx.acquirePathwayLock(pathwayId);

  const target = await tx.findVersionPublishedFlag(versionId, pathwayId);
  if (target?.published) return { ok: false, code: "ALREADY_PUBLISHED" };

  const oldPublished = await tx.findOtherPublishedVersion(pathwayId, versionId);
  const oldStages: PublishedStageSnapshot[] = oldPublished?.stages ?? [];
  const oldStageIdByKey = new Map(oldStages.map((s) => [s.stageKey, s.id]));

  const { removedWithPatients } = analyzeStageRemoval(oldStages, newStageKeys);
  if (removedWithPatients.length > 0) {
    return {
      ok: false,
      code: "REMOVED_STAGES_WITH_PATIENTS",
      stages: removedWithPatients.map((s) => ({
        stageKey: s.stageKey,
        name: s.name,
        patientCount: s.currentPatients,
      })),
    };
  }

  const own = await reconcileOwnStages(tx, {
    versionId,
    newStageKeys,
    publishedVersionId: oldPublished?.id ?? null,
    publishedKeys: new Set(oldStageIdByKey.keys()),
  });
  if (own.conflict) throw new StageKeyConflictError();

  await tx.unpublishOtherVersions(pathwayId, versionId);
  await tx.markVersionPublished(versionId);

  const existingIdByKey = new Map([...own.reusableByKey, ...oldStageIdByKey]);
  await upsertStages(tx, versionId, stages, existingIdByKey);

  const stageIdByKey = new Map(
    (await tx.listStageKeyIds(versionId)).map((s) => [s.stageKey, s.id]),
  );
  await reconcileChecklists(tx, stages, stageIdByKey);
  await replaceStageDocuments(tx, tenantId, stages, stageIdByKey);

  if (oldPublished) await tx.movePatientsToVersion(oldPublished.id, versionId);

  return { ok: true };
}
