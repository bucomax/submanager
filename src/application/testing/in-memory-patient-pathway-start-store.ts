import type {
  CreatedPatientPathwayRow,
  IPatientPathwayStartStore,
  IPatientPathwayStartTx,
  PublishedVersionForStart,
  StartStageRow,
} from "@/application/ports/patient-pathway-start.port";
import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";
import {
  auditRecorderFor,
  runInMemoryTransaction,
  type AuditLog,
} from "@/application/testing/in-memory-unit-of-work";

export type StartState = AuditLog & {
  carePathways: { id: string; tenantId: string; name: string }[];
  /** Versões publicadas por pathway, com etapas (ordenadas por `sortOrder`). */
  publishedVersions: { pathwayId: string; version: number; id: string; stages: StartStageRow[] }[];
  clients: Record<string, { id: string; name: string; phone: string }>;
  patientPathways: { id: string; clientId: string; completedAt: Date | null; row: CreatedPatientPathwayRow }[];
  transitions: { id: string; patientPathwayId: string; toStageId: string; actorUserId: string; dispatchStub: unknown }[];
  documentsByStage: Record<string, StageDocumentBundleItem[]>;
  members: string[];
  locks: string[];
};

export class InMemoryPatientPathwayStartStore implements IPatientPathwayStartStore {
  state: StartState = {
    carePathways: [],
    publishedVersions: [],
    clients: {},
    patientPathways: [],
    transitions: [],
    documentsByStage: {},
    members: [],
    locks: [],
    audits: [],
  };
  /** Simula outra requisição criando a jornada entre a checagem rápida e a transação. */
  beforeTransaction: (() => void) | null = null;
  private nextId = 1;

  async findActivePatientPathwayId(clientId: string) {
    const active = this.state.patientPathways.find((p) => p.clientId === clientId && !p.completedAt);
    return active ? { id: active.id } : null;
  }

  async findCarePathwayId(tenantId: string, pathwayId: string) {
    return this.state.carePathways.find((p) => p.id === pathwayId && p.tenantId === tenantId) ?? null;
  }

  async findPublishedVersionWithFirstStage(pathwayId: string): Promise<PublishedVersionForStart | null> {
    const latest = this.state.publishedVersions
      .filter((v) => v.pathwayId === pathwayId)
      .sort((a, b) => b.version - a.version)[0];
    return latest ? { id: latest.id, stages: latest.stages.slice(0, 1) } : null;
  }

  runInTransaction<T>(fn: (tx: IPatientPathwayStartTx) => Promise<T>): Promise<T> {
    this.beforeTransaction?.();
    return runInMemoryTransaction(this, (draft) => fn(this.createTx(draft)));
  }

  private createTx(s: StartState): IPatientPathwayStartTx {
    return {
      audit: auditRecorderFor(s),
      lockClient: async (clientId) => void s.locks.push(clientId),
      hasActivePatientPathway: async (clientId) =>
        s.patientPathways.some((p) => p.clientId === clientId && !p.completedAt),
      pickFirstTenantMember: async (tenantId, candidates) =>
        candidates.find((id) => s.members.includes(`${tenantId}:${id}`)) ?? null,
      getStageDocumentBundle: async (stageId) => s.documentsByStage[stageId] ?? [],
      createPatientPathway: async (record) => {
        const stage = s.publishedVersions.flatMap((v) => v.stages).find((st) => st.id === record.currentStageId)!;
        const pathway = s.carePathways.find((p) => p.id === record.pathwayId)!;
        const row: CreatedPatientPathwayRow = {
          id: `pp-${this.nextId++}`,
          clientId: record.clientId,
          currentStageAssigneeUserId: record.currentStageAssigneeUserId,
          enteredStageAt: record.enteredStageAt,
          createdAt: record.enteredStageAt,
          currentStage: stage,
          pathway: { id: pathway.id, name: pathway.name },
          client: s.clients[record.clientId]!,
          currentStageAssignee: record.currentStageAssigneeUserId
            ? { id: record.currentStageAssigneeUserId, name: null, email: "u@x.com" }
            : null,
        };
        s.patientPathways.push({ id: row.id, clientId: record.clientId, completedAt: null, row });
        return row;
      },
      createInitialTransition: async (record) => {
        const id = `transition-${this.nextId++}`;
        s.transitions.push({ id, ...record });
        return { id };
      },
    };
  }
}
