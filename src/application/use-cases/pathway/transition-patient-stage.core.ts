import type { z } from "zod";

import type { IClientVisibilityLookup } from "@/application/ports/client-visibility-lookup.port";
import type { IDistributedLock } from "@/application/ports/distributed-lock.port";
import type {
  IStageTransitionStore,
  IStageTransitionTx,
  PatientPathwayForTransition,
  PatientPathwayViewRow,
  TransitionTargetStage,
} from "@/application/ports/stage-transition.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";
import { canViewClientRow, type TenantMembershipClientScope } from "@/domain/client/client-visibility";
import { stageAssigneeCandidates } from "@/domain/pathway/stage-assignee";
import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";
import {
  checkStageTransitionPreconditions,
  evaluateChecklistGate,
  type PendingChecklistItem,
} from "@/domain/pathway/stage-transition-rules";
import { buildStageDispatchStub } from "@/application/use-cases/pathway/build-stage-dispatch";
import {
  runTransitionPostCommit,
  type TransitionPostCommitContext,
  type TransitionPostCommitDeps,
} from "@/application/use-cases/pathway/transition-post-commit";
import type { postStageTransitionBodySchema } from "@/lib/validators/pathway";

export type StageTransitionInput = z.infer<typeof postStageTransitionBodySchema>;

export type TransitionPatientStageErrorCode =
  | "PATIENT_PATHWAY_NOT_FOUND"
  | "PATHWAY_ALREADY_COMPLETED"
  | "TARGET_STAGE_NOT_FOUND"
  | "ALREADY_IN_TARGET_STAGE"
  | "LOCK_CONFLICT"
  /** Etapa/versão do paciente mudou entre a leitura e a escrita (transição concorrente). */
  | "STAGE_CONFLICT";

type TransitionPatientPathwayView = {
  id: string;
  currentStage: unknown;
  currentStageAssignee: { id: string; name: string | null; email: string } | null;
  enteredStageAt: string;
  updatedAt: string;
};

export type TransitionPatientStageResult =
  | {
      ok: true;
      data: { patientPathway: TransitionPatientPathwayView };
      /** Efeitos pós-commit; a rota deve agendar com `after()` (não bloqueia resposta, sobrevive em serverless). */
      afterCommit: () => Promise<void>;
    }
  | { ok: false; code: TransitionPatientStageErrorCode }
  | { ok: false; code: "CHECKLIST_BLOCKED"; pendingItems: PendingChecklistItem[] };

export type TransitionPatientStageParams = {
  tenantId: string;
  actorUserId: string;
  patientPathwayId: string;
  input: StageTransitionInput;
  /** Escopo de visibilidade do ator; paciente fora do escopo responde como inexistente. */
  clientVisibility?: { scope: TenantMembershipClientScope; viewerUserId: string };
};

export type TransitionPatientStageDeps = {
  store: IStageTransitionStore;
  clients: IClientVisibilityLookup;
  lock: IDistributedLock;
  cache: ITenantListCache;
  postCommit: TransitionPostCommitDeps;
};

function toView(row: PatientPathwayViewRow): TransitionPatientPathwayView {
  return {
    id: row.id,
    currentStage: row.currentStage,
    currentStageAssignee: row.currentStageAssignee
      ? {
          id: row.currentStageAssignee.id,
          name: row.currentStageAssignee.name,
          email: row.currentStageAssignee.email,
        }
      : null,
    enteredStageAt: row.enteredStageAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const NOOP = async () => {};

/** Replay idempotente: devolve o estado atual se `correlationId` já gerou transição neste paciente. */
async function findReplay(
  store: IStageTransitionStore,
  patientPathwayId: string,
  toStageId: string,
  correlationId: string,
): Promise<TransitionPatientStageResult | null> {
  const replay = await store.runInTransaction(async (tx) => {
    const existing = await tx.findTransitionByCorrelation(patientPathwayId, correlationId);
    if (!existing) return null;
    if (existing.toStageId !== toStageId) return "conflict" as const;
    return tx.loadPatientPathwayView(patientPathwayId);
  });
  if (replay === null) return null;
  if (replay === "conflict") return { ok: false, code: "STAGE_CONFLICT" };
  return { ok: true, data: { patientPathway: toView(replay) }, afterCommit: NOOP };
}

/** Retry concorrente com o mesmo `correlationId`: após conflito, devolve o replay se a transição já foi gravada. */
async function replayOr(
  store: IStageTransitionStore,
  patientPathwayId: string,
  parsed: StageTransitionInput,
  fallback: TransitionPatientStageResult,
): Promise<TransitionPatientStageResult> {
  if (!parsed.correlationId) return fallback;
  return (
    (await findReplay(store, patientPathwayId, parsed.toStageId, parsed.correlationId)) ?? fallback
  );
}

type TxOutcome =
  | { outcome: "blocked"; pending: PendingChecklistItem[] }
  | { outcome: "conflict" }
  | { outcome: "already_in_target" }
  | { outcome: "completed" }
  | {
      outcome: "ok";
      patientPathway: PatientPathwayViewRow;
      fromStageId: string;
      transitionId: string;
      documents: StageDocumentBundleItem[];
    };

type ApplyTransitionParams = {
  tenantId: string;
  actorUserId: string;
  pp: PatientPathwayForTransition;
  toStage: TransitionTargetStage;
  parsed: StageTransitionInput;
};

/** Corpo da transação: tudo é decidido a partir do estado re-lido dentro da tx. */
async function applyTransition(
  tx: IStageTransitionTx,
  { tenantId, actorUserId, pp, toStage, parsed }: ApplyTransitionParams,
): Promise<TxOutcome> {
  const fresh = await tx.findPatientPathwayState(tenantId, pp.id);
  const blocker = checkStageTransitionPreconditions({
    fresh,
    expectedPathwayVersionId: pp.pathwayVersionId,
    toStageId: toStage.id,
  });
  if (blocker) return { outcome: blocker };
  const state = fresh!;

  const fromStageId = state.currentStageId;
  const gate = evaluateChecklistGate({
    pending: await tx.listPendingRequiredChecklistItems(pp.id, fromStageId),
    force: parsed.force,
    overrideReason: parsed.overrideReason,
  });
  if (gate.kind === "blocked") return { outcome: "blocked", pending: gate.pending };

  const documents = await tx.getStageDocumentBundle(toStage.id);
  const currentStageAssigneeUserId = await tx.pickFirstTenantMember(
    tenantId,
    stageAssigneeCandidates(toStage, pp.client.assignedToUserId),
  );

  // Claim condicional: serializa transições concorrentes (a segunda vê `false` após o commit da primeira).
  const claimed = await tx.claimStage({
    tenantId,
    patientPathwayId: pp.id,
    fromStageId,
    toStageId: toStage.id,
    enteredStageAt: new Date(),
    assigneeUserId: currentStageAssigneeUserId,
  });
  if (!claimed) return { outcome: "conflict" };

  const createdTransition = await tx.createStageTransition({
    patientPathwayId: pp.id,
    fromStageId,
    toStageId: toStage.id,
    actorUserId,
    note: parsed.note?.trim() || null,
    ruleOverrideReason: gate.overrideReason,
    forcedByUserId: gate.forcedOverride ? actorUserId : null,
    correlationId: parsed.correlationId ?? null,
    dispatchStub: buildStageDispatchStub({
      tenantId,
      clientId: pp.clientId,
      stageId: toStage.id,
      stageName: toStage.name,
      documents,
    }),
  });

  await tx.audit.record({
    tenantId,
    clientId: pp.clientId,
    patientPathwayId: pp.id,
    actorUserId,
    type: AuditEventType.STAGE_TRANSITION,
    payload: {
      transitionId: createdTransition.id,
      fromStageId,
      toStageId: toStage.id,
      fromStageName: state.currentStageName,
      toStageName: toStage.name,
      // LGPD: texto livre do override fica só em StageTransition.ruleOverrideReason.
      forcedOverride: gate.forcedOverride,
    },
  });

  return {
    outcome: "ok",
    patientPathway: await tx.loadPatientPathwayView(pp.id),
    fromStageId,
    transitionId: createdTransition.id,
    documents,
  };
}

/** Paciente fora do escopo de visibilidade do ator responde como inexistente. */
async function isVisibleToActor(
  params: TransitionPatientStageParams,
  pp: PatientPathwayForTransition,
  clients: IClientVisibilityLookup,
): Promise<boolean> {
  const { clientVisibility, tenantId } = params;
  if (!clientVisibility || clientVisibility.scope.role === "tenant_admin") return true;
  const clientRow = await clients.findClientAssigneeSummary(tenantId, pp.clientId);
  return (
    clientRow != null &&
    canViewClientRow(clientRow, clientVisibility.scope, clientVisibility.viewerUserId)
  );
}

/**
 * Transição de etapa: lock, transação (re-leitura, checklist, update condicional, transição, audit),
 * cache e retorno dos efeitos pós-commit para o chamador agendar.
 */
export async function transitionPatientStage(
  params: TransitionPatientStageParams,
  deps: TransitionPatientStageDeps,
): Promise<TransitionPatientStageResult> {
  const { tenantId, actorUserId, patientPathwayId, input: parsed } = params;
  const { store } = deps;

  const pp = await store.findPatientPathwayForTransition(tenantId, patientPathwayId);
  if (!pp || !(await isVisibleToActor(params, pp, deps.clients))) {
    return { ok: false, code: "PATIENT_PATHWAY_NOT_FOUND" };
  }

  if (parsed.correlationId) {
    const replay = await findReplay(store, pp.id, parsed.toStageId, parsed.correlationId);
    if (replay) return replay;
  }

  if (pp.completedAt) {
    return { ok: false, code: "PATHWAY_ALREADY_COMPLETED" };
  }

  const toStage = await store.findStageInVersion(pp.pathwayVersionId, parsed.toStageId);
  if (!toStage) {
    return { ok: false, code: "TARGET_STAGE_NOT_FOUND" };
  }

  if (toStage.id === pp.currentStageId) {
    return replayOr(store, pp.id, parsed, { ok: false, code: "ALREADY_IN_TARGET_STAGE" });
  }

  // Exclusão mútua best-effort (fail-open sem Redis); a consistência real vem do update condicional na tx.
  const lock = await deps.lock.acquire(`lock:transition:${patientPathwayId}`, 10);
  if (!lock) {
    return replayOr(store, pp.id, parsed, { ok: false, code: "LOCK_CONFLICT" });
  }

  let txResult: TxOutcome;
  try {
    txResult = await store.runInTransaction((tx) =>
      applyTransition(tx, { tenantId, actorUserId, pp, toStage, parsed }),
    );
  } finally {
    await lock.release();
  }

  switch (txResult.outcome) {
    case "blocked":
      return { ok: false, code: "CHECKLIST_BLOCKED", pendingItems: txResult.pending };
    case "conflict":
      return replayOr(store, pp.id, parsed, { ok: false, code: "STAGE_CONFLICT" });
    case "already_in_target":
      return replayOr(store, pp.id, parsed, { ok: false, code: "ALREADY_IN_TARGET_STAGE" });
    case "completed":
      return { ok: false, code: "PATHWAY_ALREADY_COMPLETED" };
    case "ok":
      break;
  }

  deps.cache.revalidateClientsList(tenantId);

  const postCommit: TransitionPostCommitContext = {
    tenantId,
    transitionId: txResult.transitionId,
    patientPathwayId: pp.id,
    fromStageId: txResult.fromStageId,
    toStage: { id: toStage.id, name: toStage.name, patientMessage: toStage.patientMessage },
    client: {
      id: pp.clientId,
      name: pp.client.name,
      email: pp.client.email,
      phone: pp.client.phone,
    },
    currentStageAssigneeUserId: txResult.patientPathway.currentStageAssigneeUserId,
    documents: txResult.documents,
  };

  return {
    ok: true,
    data: { patientPathway: toView(txResult.patientPathway) },
    afterCommit: () => runTransitionPostCommit(postCommit, deps.postCommit),
  };
}
