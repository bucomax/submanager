import type { ExistingChecklistItem, DesiredChecklistItem } from "@/domain/pathway/checklist-diff";
import type { OwnStageSnapshot, PublishedStageSnapshot } from "@/domain/pathway/stage-removal";

export type PublishedVersionSnapshot = { id: string; stages: PublishedStageSnapshot[] };

export type StageFields = {
  name: string;
  sortOrder: number;
  patientMessage: string | null;
  alertWarningDays: number | null;
  alertCriticalDays: number | null;
  defaultAssigneeUserId: string | null;
  defaultAssigneeUserIds: string[];
};

/** Leituras usadas pelo preflight (também expostas ao preview). */
export interface IPublishPreflightReader {
  /** Outra versão publicada do pathway (≠ `excludeVersionId`) com etapas por `sortOrder` e contagem de pacientes. */
  findOtherPublishedVersion(
    pathwayId: string,
    excludeVersionId: string,
  ): Promise<PublishedVersionSnapshot | null>;
  /** Subconjunto de `userIds` que tem membership no tenant. */
  findTenantMemberUserIds(tenantId: string, userIds: string[]): Promise<string[]>;
}

/** Escritas da publicação; todas dentro da mesma transação. */
export interface IPublishTx extends Pick<IPublishPreflightReader, "findOtherPublishedVersion"> {
  /** Serializa publicações concorrentes do mesmo pathway. */
  acquirePathwayLock(pathwayId: string): Promise<void>;
  findVersionPublishedFlag(versionId: string, pathwayId: string): Promise<{ published: boolean } | null>;
  /** Etapas que já pertencem à versão alvo, com contagem de histórico. */
  listVersionStagesWithHistory(versionId: string): Promise<OwnStageSnapshot[]>;
  deleteStage(stageId: string): Promise<void>;
  moveStageToVersion(stageId: string, versionId: string): Promise<void>;
  unpublishOtherVersions(pathwayId: string, exceptVersionId: string): Promise<void>;
  markVersionPublished(versionId: string): Promise<void>;
  /** Atualiza a etapa e a move para `versionId`. */
  updateStage(stageId: string, versionId: string, fields: StageFields): Promise<void>;
  createStage(versionId: string, stageKey: string, fields: StageFields): Promise<void>;
  listStageKeyIds(versionId: string): Promise<{ id: string; stageKey: string }[]>;
  listChecklistItems(stageId: string): Promise<ExistingChecklistItem[]>;
  updateChecklistItem(itemId: string, data: DesiredChecklistItem): Promise<void>;
  createChecklistItems(stageId: string, items: DesiredChecklistItem[]): Promise<void>;
  deleteChecklistItems(itemIds: string[]): Promise<void>;
  /** Subconjunto de `fileAssetIds` que pertence ao tenant. */
  findTenantFileIds(tenantId: string, fileAssetIds: string[]): Promise<string[]>;
  deleteStageDocuments(stageIds: string[]): Promise<void>;
  createStageDocuments(
    rows: { pathwayStageId: string; fileAssetId: string; sortOrder: number }[],
  ): Promise<void>;
  /** Move pacientes da versão antiga para a nova. */
  movePatientsToVersion(fromVersionId: string, toVersionId: string): Promise<void>;
}

export type PublishedVersionWithStages = {
  id: string;
  pathwayId: string;
  version: number;
  published: boolean;
  stages: Array<{
    id: string;
    stageKey: string;
    name: string;
    sortOrder: number;
    patientMessage: string | null;
    alertWarningDays: number | null;
    alertCriticalDays: number | null;
    defaultAssigneeUserId: string | null;
    defaultAssigneeUserIds: string[];
  }>;
};

export interface IPathwayPublishStore extends IPublishPreflightReader {
  findCarePathwayIdForPublish(tenantId: string, pathwayId: string): Promise<{ id: string } | null>;
  findPathwayVersionForPublish(
    pathwayId: string,
    versionId: string,
  ): Promise<{ graphJson: unknown } | null>;
  findVersionWithStages(versionId: string): Promise<PublishedVersionWithStages | null>;
  runInTransaction<T>(fn: (tx: IPublishTx) => Promise<T>): Promise<T>;
}
