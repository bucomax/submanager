import type {
  IPathwayPublishStore,
  IPublishTx,
  PublishedVersionSnapshot,
  PublishedVersionWithStages,
  StageFields,
} from "@/application/ports/pathway-publish.port";
import { runInMemoryTransaction } from "@/application/testing/in-memory-unit-of-work";

export type FakeVersion = {
  id: string;
  pathwayId: string;
  version: number;
  published: boolean;
  graphJson: unknown;
};

export type FakePublishStage = StageFields & { id: string; versionId: string; stageKey: string };
export type FakeChecklistItem = {
  id: string;
  stageId: string;
  label: string;
  sortOrder: number;
  requiredForTransition: boolean;
};

export type PathwayPublishState = {
  carePathways: { id: string; tenantId: string }[];
  versions: FakeVersion[];
  stages: FakePublishStage[];
  checklistItems: FakeChecklistItem[];
  /** Progresso do paciente por item (cascade ao apagar o item). */
  checklistProgress: { patientPathwayId: string; itemId: string }[];
  stageDocuments: { stageId: string; fileAssetId: string; sortOrder: number }[];
  files: { id: string; tenantId: string }[];
  patientPathways: { id: string; versionId: string; currentStageId: string }[];
  transitions: { id: string; fromStageId: string | null; toStageId: string }[];
  members: string[];
  /** Chaves de lock adquiridas (`pathwayId`). */
  locks: string[];
};

export function emptyPublishState(): PathwayPublishState {
  return {
    carePathways: [],
    versions: [],
    stages: [],
    checklistItems: [],
    checklistProgress: [],
    stageDocuments: [],
    files: [],
    patientPathways: [],
    transitions: [],
    members: [],
    locks: [],
  };
}

/** Fake do `IPathwayPublishStore` com cascatas equivalentes às do schema Prisma. */
export class InMemoryPathwayPublishStore implements IPathwayPublishStore {
  state: PathwayPublishState = emptyPublishState();
  private nextId = 1;

  private snapshotOtherPublished(
    s: PathwayPublishState,
    pathwayId: string,
    excludeVersionId: string,
  ): PublishedVersionSnapshot | null {
    const version = s.versions.find(
      (v) => v.pathwayId === pathwayId && v.published && v.id !== excludeVersionId,
    );
    if (!version) return null;
    const stages = s.stages
      .filter((st) => st.versionId === version.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((st) => ({
        id: st.id,
        stageKey: st.stageKey,
        name: st.name,
        currentPatients: s.patientPathways.filter((p) => p.currentStageId === st.id).length,
      }));
    return { id: version.id, stages };
  }

  async findOtherPublishedVersion(pathwayId: string, excludeVersionId: string) {
    return this.snapshotOtherPublished(this.state, pathwayId, excludeVersionId);
  }

  async findTenantMemberUserIds(tenantId: string, userIds: string[]) {
    return userIds.filter((id) => this.state.members.includes(`${tenantId}:${id}`));
  }

  async findCarePathwayIdForPublish(tenantId: string, pathwayId: string) {
    return this.state.carePathways.find((p) => p.id === pathwayId && p.tenantId === tenantId) ?? null;
  }

  async findPathwayVersionForPublish(pathwayId: string, versionId: string) {
    return this.state.versions.find((v) => v.id === versionId && v.pathwayId === pathwayId) ?? null;
  }

  async findVersionWithStages(versionId: string): Promise<PublishedVersionWithStages | null> {
    const version = this.state.versions.find((v) => v.id === versionId);
    if (!version) return null;
    const stages = this.state.stages
      .filter((s) => s.versionId === versionId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((stage) => ({ ...stage, versionId: undefined }));
    return { id: version.id, pathwayId: version.pathwayId, version: version.version, published: version.published, stages };
  }

  runInTransaction<T>(fn: (tx: IPublishTx) => Promise<T>): Promise<T> {
    return runInMemoryTransaction(this, (draft) => fn(this.createTx(draft)));
  }

  private createTx(s: PathwayPublishState): IPublishTx {
    const removeChecklistItems = (predicate: (i: FakeChecklistItem) => boolean) => {
      const removed = new Set(s.checklistItems.filter(predicate).map((i) => i.id));
      s.checklistItems = s.checklistItems.filter((i) => !removed.has(i.id));
      s.checklistProgress = s.checklistProgress.filter((p) => !removed.has(p.itemId));
    };
    return {
      findOtherPublishedVersion: async (pathwayId, exclude) => this.snapshotOtherPublished(s, pathwayId, exclude),
      acquirePathwayLock: async (pathwayId) => void s.locks.push(pathwayId),
      findVersionPublishedFlag: async (versionId, pathwayId) => {
        const v = s.versions.find((x) => x.id === versionId && x.pathwayId === pathwayId);
        return v ? { published: v.published } : null;
      },
      listVersionStagesWithHistory: async (versionId) =>
        s.stages
          .filter((st) => st.versionId === versionId)
          .map((st) => ({
            id: st.id,
            stageKey: st.stageKey,
            currentPatients: s.patientPathways.filter((p) => p.currentStageId === st.id).length,
            transitionsTo: s.transitions.filter((t) => t.toStageId === st.id).length,
            transitionsFrom: s.transitions.filter((t) => t.fromStageId === st.id).length,
          })),
      deleteStage: async (stageId) => {
        s.stages = s.stages.filter((st) => st.id !== stageId);
        removeChecklistItems((i) => i.stageId === stageId);
        s.stageDocuments = s.stageDocuments.filter((d) => d.stageId !== stageId);
      },
      moveStageToVersion: async (stageId, versionId) => {
        s.stages.find((st) => st.id === stageId)!.versionId = versionId;
      },
      unpublishOtherVersions: async (pathwayId, except) => {
        s.versions.filter((v) => v.pathwayId === pathwayId && v.id !== except).forEach((v) => (v.published = false));
      },
      markVersionPublished: async (versionId) => {
        s.versions.find((v) => v.id === versionId)!.published = true;
      },
      updateStage: async (stageId, versionId, fields) => {
        Object.assign(s.stages.find((st) => st.id === stageId)!, fields, { versionId });
      },
      createStage: async (versionId, stageKey, fields) => {
        s.stages.push({ id: `stage-${this.nextId++}`, versionId, stageKey, ...fields });
      },
      listStageKeyIds: async (versionId) =>
        s.stages.filter((st) => st.versionId === versionId).map(({ id, stageKey }) => ({ id, stageKey })),
      listChecklistItems: async (stageId) =>
        s.checklistItems.filter((i) => i.stageId === stageId).map(({ id, label, sortOrder }) => ({ id, label, sortOrder })),
      updateChecklistItem: async (itemId, data) => {
        Object.assign(s.checklistItems.find((i) => i.id === itemId)!, data);
      },
      createChecklistItems: async (stageId, items) => {
        items.forEach((item) => s.checklistItems.push({ id: `item-${this.nextId++}`, stageId, ...item }));
      },
      deleteChecklistItems: async (itemIds) => removeChecklistItems((i) => itemIds.includes(i.id)),
      findTenantFileIds: async (tenantId, ids) =>
        s.files.filter((f) => f.tenantId === tenantId && ids.includes(f.id)).map((f) => f.id),
      deleteStageDocuments: async (stageIds) => {
        s.stageDocuments = s.stageDocuments.filter((d) => !stageIds.includes(d.stageId));
      },
      createStageDocuments: async (rows) => {
        rows.forEach((r) => s.stageDocuments.push({ stageId: r.pathwayStageId, fileAssetId: r.fileAssetId, sortOrder: r.sortOrder }));
      },
      movePatientsToVersion: async (from, to) => {
        s.patientPathways.filter((p) => p.versionId === from).forEach((p) => (p.versionId = to));
      },
    };
  }
}
