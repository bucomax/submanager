import type { IClientVisibilityLookup } from "@/application/ports/client-visibility-lookup.port";
import type {
  CreateStageTransitionRecord,
  IStageTransitionStore,
  IStageTransitionTx,
  PatientPathwayViewRow,
} from "@/application/ports/stage-transition.port";
import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";
import {
  auditRecorderFor,
  runInMemoryTransaction,
  type AuditLog,
} from "@/application/testing/in-memory-unit-of-work";

export type FakePatientPathway = {
  id: string;
  tenantId: string;
  clientId: string;
  pathwayVersionId: string;
  currentStageId: string;
  completedAt: Date | null;
  enteredStageAt: Date;
  updatedAt: Date;
  currentStageAssigneeUserId: string | null;
};

export type FakeStage = {
  id: string;
  name: string;
  pathwayVersionId: string;
  patientMessage: string | null;
  defaultAssigneeUserIds: string[];
  defaultAssigneeUserId: string | null;
};

export type FakeClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  assignedToUserId: string | null;
  opmeSupplierId: string | null;
};

type StoredTransition = CreateStageTransitionRecord & { id: string };

export type StageTransitionState = AuditLog & {
  patientPathways: Record<string, FakePatientPathway>;
  clients: Record<string, FakeClient>;
  stages: Record<string, FakeStage>;
  /** Itens de checklist obrigatórios por etapa. */
  requiredChecklist: { id: string; stageId: string; label: string; sortOrder: number }[];
  /** Chaves `${patientPathwayId}:${itemId}` concluídas. */
  completedChecklist: string[];
  documentsByStage: Record<string, StageDocumentBundleItem[]>;
  /** Chaves `${tenantId}:${userId}`. */
  members: string[];
  transitions: StoredTransition[];
};

export function emptyStageTransitionState(): StageTransitionState {
  return {
    patientPathways: {},
    clients: {},
    stages: {},
    requiredChecklist: [],
    completedChecklist: [],
    documentsByStage: {},
    members: [],
    transitions: [],
    audits: [],
  };
}

/** Fake do `IStageTransitionStore` com a mesma semântica do Prisma (claim condicional, unique por correlationId). */
export class InMemoryStageTransitionStore implements IStageTransitionStore, IClientVisibilityLookup {
  state: StageTransitionState = emptyStageTransitionState();
  /** Simula uma transição concorrente que vence a corrida entre a leitura e a transação. */
  beforeTransaction: (() => void) | null = null;
  /** Fault injection: o update condicional perde a corrida (count 0). */
  forceClaimConflict = false;
  private nextId = 1;

  async findPatientPathwayForTransition(tenantId: string, id: string) {
    const pp = this.state.patientPathways[id];
    if (!pp || pp.tenantId !== tenantId) return null;
    const client = this.state.clients[pp.clientId]!;
    return {
      id: pp.id,
      clientId: pp.clientId,
      pathwayVersionId: pp.pathwayVersionId,
      currentStageId: pp.currentStageId,
      completedAt: pp.completedAt,
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        assignedToUserId: client.assignedToUserId,
      },
    };
  }

  async findStageInVersion(pathwayVersionId: string, stageId: string) {
    const stage = this.state.stages[stageId];
    return stage && stage.pathwayVersionId === pathwayVersionId ? stage : null;
  }

  async findClientAssigneeSummary(_tenantId: string, clientId: string) {
    const client = this.state.clients[clientId];
    return client
      ? { id: client.id, assignedToUserId: client.assignedToUserId, opmeSupplierId: client.opmeSupplierId }
      : null;
  }

  async runInTransaction<T>(fn: (tx: IStageTransitionTx) => Promise<T>): Promise<T> {
    this.beforeTransaction?.();
    return runInMemoryTransaction(this, (draft) => fn(this.createTx(draft)));
  }

  private createTx(draft: StageTransitionState): IStageTransitionTx {
    const view = (id: string): PatientPathwayViewRow => {
      const pp = draft.patientPathways[id];
      if (!pp) throw new Error("not found");
      return {
        id: pp.id,
        currentStage: draft.stages[pp.currentStageId],
        currentStageAssignee: null,
        enteredStageAt: pp.enteredStageAt,
        updatedAt: pp.updatedAt,
        currentStageAssigneeUserId: pp.currentStageAssigneeUserId,
      };
    };
    return {
      audit: auditRecorderFor(draft),
      findPatientPathwayState: async (tenantId, id) => {
        const pp = draft.patientPathways[id];
        if (!pp || pp.tenantId !== tenantId) return null;
        return {
          currentStageId: pp.currentStageId,
          pathwayVersionId: pp.pathwayVersionId,
          completedAt: pp.completedAt,
          currentStageName: draft.stages[pp.currentStageId]?.name ?? null,
        };
      },
      listPendingRequiredChecklistItems: async (ppId, stageId) =>
        draft.requiredChecklist
          .filter((i) => i.stageId === stageId && !draft.completedChecklist.includes(`${ppId}:${i.id}`))
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map(({ id, label }) => ({ id, label })),
      getStageDocumentBundle: async (stageId) => draft.documentsByStage[stageId] ?? [],
      pickFirstTenantMember: async (tenantId, candidates) =>
        candidates.find((id) => draft.members.includes(`${tenantId}:${id}`)) ?? null,
      claimStage: async (p) => {
        const pp = draft.patientPathways[p.patientPathwayId];
        if (this.forceClaimConflict || !pp || pp.tenantId !== p.tenantId || pp.currentStageId !== p.fromStageId || pp.completedAt) {
          return false;
        }
        Object.assign(pp, {
          currentStageId: p.toStageId,
          enteredStageAt: p.enteredStageAt,
          currentStageAssigneeUserId: p.assigneeUserId,
          updatedAt: new Date(),
        });
        return true;
      },
      createStageTransition: async (record) => {
        const duplicate =
          record.correlationId != null &&
          draft.transitions.some(
            (t) =>
              t.patientPathwayId === record.patientPathwayId && t.correlationId === record.correlationId,
          );
        if (duplicate) throw new Error("unique violation (patientPathwayId, correlationId)");
        const id = `transition-${this.nextId++}`;
        draft.transitions.push({ ...record, id });
        return { id };
      },
      loadPatientPathwayView: async (id) => view(id),
      findTransitionByCorrelation: async (ppId, correlationId) =>
        draft.transitions.find((t) => t.patientPathwayId === ppId && t.correlationId === correlationId) ??
        null,
    };
  }
}
