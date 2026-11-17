import type { PathwayStage, Prisma } from "@prisma/client";
import type { z } from "zod";

import { revalidateTenantClientsList } from "@/infrastructure/cache/revalidate-tenant-lists";
import { recordAuditEvent, AuditEventType } from "@/infrastructure/audit/record-audit-event";
import { pathwayPrismaRepository } from "@/infrastructure/repositories/pathway.repository";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import {
  buildStageDispatchStub,
  getStageDocumentBundle,
  type StageDocumentBundleItem,
} from "@/application/use-cases/pathway/build-stage-dispatch";
import { resolvePatientPathwayStageAssigneeUserId } from "@/application/use-cases/shared/validate-tenant-members";
import { pathwayChecklistPrismaRepository } from "@/infrastructure/repositories/pathway-checklist.repository";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import {
  canViewClientRow,
  type TenantMembershipClientScope,
} from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  runTransitionPostCommit,
  type TransitionPostCommitContext,
} from "@/application/use-cases/pathway/transition-post-commit";
import { acquireLock } from "@/lib/api/distributed-lock";
import { postStageTransitionBodySchema } from "@/lib/validators/pathway";

export type StageTransitionInput = z.infer<typeof postStageTransitionBodySchema>;

export { postStageTransitionBodySchema };

/**
 * Itens obrigatórios de checklist ainda pendentes na etapa atual (transição de etapa).
 */
export async function listPendingRequiredChecklistItems(
  tx: unknown,
  patientPathwayId: string,
  currentStageId: string,
): Promise<{ id: string; label: string }[]> {
  return pathwayChecklistPrismaRepository.listPendingRequiredForTransition(
    tx,
    patientPathwayId,
    currentStageId,
  );
}

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
  | { ok: false; code: "CHECKLIST_BLOCKED"; pendingItems: { id: string; label: string }[] };

type PatientPathwayRow = {
  id: string;
  currentStage: unknown;
  currentStageAssignee: { id: string; name: string | null; email: string } | null;
  enteredStageAt: Date;
  updatedAt: Date;
  currentStageAssigneeUserId: string | null;
};

function toView(row: PatientPathwayRow): TransitionPatientPathwayView {
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
  patientPathwayId: string,
  toStageId: string,
  correlationId: string,
): Promise<TransitionPatientStageResult | null> {
  const replay = await patientPathwayPrismaRepository.runInTransaction(async (txRaw) => {
    const tx = txRaw as Prisma.TransactionClient;
    const existing = await tx.stageTransition.findUnique({
      where: { patientPathwayId_correlationId: { patientPathwayId, correlationId } },
      select: { toStageId: true },
    });
    if (!existing) return null;
    if (existing.toStageId !== toStageId) return "conflict" as const;
    return tx.patientPathway.findUnique({
      where: { id: patientPathwayId },
      include: {
        currentStage: true,
        currentStageAssignee: { select: { id: true, name: true, email: true } },
      },
    });
  });
  if (replay === null) return null;
  if (replay === "conflict") return { ok: false, code: "STAGE_CONFLICT" };
  return { ok: true, data: { patientPathway: toView(replay) }, afterCommit: NOOP };
}

/** Retry concorrente com o mesmo `correlationId`: após conflito, devolve o replay se a transição já foi gravada. */
async function replayOr(
  patientPathwayId: string,
  parsed: StageTransitionInput,
  fallback: TransitionPatientStageResult,
): Promise<TransitionPatientStageResult> {
  if (!parsed.correlationId) return fallback;
  return (await findReplay(patientPathwayId, parsed.toStageId, parsed.correlationId)) ?? fallback;
}

type TxOutcome =
  | { outcome: "blocked"; pending: { id: string; label: string }[] }
  | { outcome: "conflict" }
  | { outcome: "already_in_target" }
  | { outcome: "completed" }
  | {
      outcome: "ok";
      patientPathway: PatientPathwayRow;
      fromStageId: string;
      transitionId: string;
      documents: StageDocumentBundleItem[];
    };

/**
 * Transição de etapa: lock, transação (re-leitura, checklist, update condicional, transição, audit),
 * cache e retorno dos efeitos pós-commit para o chamador agendar.
 */
export async function runTransitionPatientStage(params: {
  tenantId: string;
  actorUserId: string;
  patientPathwayId: string;
  input: StageTransitionInput;
  /** Escopo de visibilidade do ator; paciente fora do escopo responde como inexistente. */
  clientVisibility?: { scope: TenantMembershipClientScope; viewerUserId: string };
}): Promise<TransitionPatientStageResult> {
  const { tenantId, actorUserId, patientPathwayId, input: parsed, clientVisibility } = params;

  const pp = await patientPathwayPrismaRepository.findForStageTransition(tenantId, patientPathwayId);
  if (!pp) {
    return { ok: false, code: "PATIENT_PATHWAY_NOT_FOUND" };
  }

  if (clientVisibility && clientVisibility.scope.role !== "tenant_admin") {
    const clientRow = await clientPrismaRepository.findClientAssigneeSummary(tenantId, pp.clientId);
    if (!clientRow || !canViewClientRow(clientRow, clientVisibility.scope, clientVisibility.viewerUserId)) {
      return { ok: false, code: "PATIENT_PATHWAY_NOT_FOUND" };
    }
  }

  if (parsed.correlationId) {
    const replay = await findReplay(pp.id, parsed.toStageId, parsed.correlationId);
    if (replay) return replay;
  }

  if (pp.completedAt) {
    return { ok: false, code: "PATHWAY_ALREADY_COMPLETED" };
  }

  const toStage = (await pathwayPrismaRepository.findPathwayStageInVersion(
    pp.pathwayVersionId,
    parsed.toStageId,
  )) as PathwayStage | null;
  if (!toStage) {
    return { ok: false, code: "TARGET_STAGE_NOT_FOUND" };
  }

  if (toStage.id === pp.currentStageId) {
    return replayOr(pp.id, parsed, { ok: false, code: "ALREADY_IN_TARGET_STAGE" });
  }

  // Exclusão mútua best-effort (fail-open sem Redis); a consistência real vem do update condicional na tx.
  const lock = await acquireLock(`lock:transition:${patientPathwayId}`, 10);
  if (!lock) {
    return replayOr(pp.id, parsed, { ok: false, code: "LOCK_CONFLICT" });
  }

  let txResult: TxOutcome;
  try {
    txResult = await patientPathwayPrismaRepository.runInTransaction(async (txRaw) => {
      const tx = txRaw as Prisma.TransactionClient;
      return applyTransition(tx, { tenantId, actorUserId, pp, toStage, parsed });
    });
  } finally {
    await lock.release();
  }

  switch (txResult.outcome) {
    case "blocked":
      return { ok: false, code: "CHECKLIST_BLOCKED", pendingItems: txResult.pending };
    case "conflict":
      return replayOr(pp.id, parsed, { ok: false, code: "STAGE_CONFLICT" });
    case "already_in_target":
      return replayOr(pp.id, parsed, { ok: false, code: "ALREADY_IN_TARGET_STAGE" });
    case "completed":
      return { ok: false, code: "PATHWAY_ALREADY_COMPLETED" };
    case "ok":
      break;
  }

  revalidateTenantClientsList(tenantId);

  const postCommit: TransitionPostCommitContext = {
    tenantId,
    transitionId: txResult.transitionId,
    patientPathwayId: pp.id,
    fromStageId: txResult.fromStageId,
    toStage: { id: toStage.id, name: toStage.name, patientMessage: toStage.patientMessage ?? null },
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
    afterCommit: () => runTransitionPostCommit(postCommit),
  };
}

type ApplyTransitionParams = {
  tenantId: string;
  actorUserId: string;
  pp: NonNullable<Awaited<ReturnType<typeof patientPathwayPrismaRepository.findForStageTransition>>>;
  toStage: PathwayStage;
  parsed: StageTransitionInput;
};

/** Corpo da transação: tudo é decidido a partir do estado re-lido dentro da tx. */
async function applyTransition(
  tx: Prisma.TransactionClient,
  { tenantId, actorUserId, pp, toStage, parsed }: ApplyTransitionParams,
): Promise<TxOutcome> {
  const fresh = await tx.patientPathway.findFirst({
    where: { id: pp.id, tenantId },
    select: {
      currentStageId: true,
      pathwayVersionId: true,
      completedAt: true,
      currentStage: { select: { name: true } },
    },
  });
  if (!fresh || fresh.pathwayVersionId !== pp.pathwayVersionId) return { outcome: "conflict" };
  if (fresh.completedAt) return { outcome: "completed" };
  if (fresh.currentStageId === toStage.id) return { outcome: "already_in_target" };

  const fromStageId = fresh.currentStageId;
  const pendingRequired = await listPendingRequiredChecklistItems(tx, pp.id, fromStageId);
  if (pendingRequired.length > 0 && !parsed.force) {
    return { outcome: "blocked", pending: pendingRequired };
  }
  const forcedOverride = pendingRequired.length > 0 && Boolean(parsed.force);
  const overrideReason = forcedOverride ? (parsed.overrideReason?.trim() ?? "") || null : null;

  const documents = await getStageDocumentBundle(tx, toStage.id);
  const currentStageAssigneeUserId = await resolvePatientPathwayStageAssigneeUserId(
    tx,
    tenantId,
    {
      defaultAssigneeUserIds: toStage.defaultAssigneeUserIds,
      defaultAssigneeUserId: toStage.defaultAssigneeUserId,
    },
    pp.client.assignedToUserId,
  );

  // Claim condicional: serializa transições concorrentes (a segunda vê count 0 após o commit da primeira).
  const claimed = await tx.patientPathway.updateMany({
    where: { id: pp.id, tenantId, currentStageId: fromStageId, completedAt: null },
    data: { currentStageId: toStage.id, enteredStageAt: new Date(), currentStageAssigneeUserId },
  });
  if (claimed.count === 0) return { outcome: "conflict" };

  const createdTransition = await tx.stageTransition.create({
    data: {
      patientPathwayId: pp.id,
      fromStageId,
      toStageId: toStage.id,
      actorUserId,
      note: parsed.note?.trim() || null,
      ruleOverrideReason: overrideReason,
      forcedByUserId: forcedOverride ? actorUserId : null,
      correlationId: parsed.correlationId ?? null,
      dispatchStub: buildStageDispatchStub({
        tenantId,
        clientId: pp.clientId,
        stageId: toStage.id,
        stageName: toStage.name,
        documents,
      }),
    },
    select: { id: true },
  });

  await recordAuditEvent(tx, {
    tenantId,
    clientId: pp.clientId,
    patientPathwayId: pp.id,
    actorUserId,
    type: AuditEventType.STAGE_TRANSITION,
    payload: {
      transitionId: createdTransition.id,
      fromStageId,
      toStageId: toStage.id,
      fromStageName: fresh.currentStage?.name ?? null,
      toStageName: toStage.name,
      // LGPD: texto livre do override fica só em StageTransition.ruleOverrideReason.
      forcedOverride,
    },
  });

  const nextPp = await tx.patientPathway.findUniqueOrThrow({
    where: { id: pp.id },
    include: {
      currentStage: true,
      currentStageAssignee: { select: { id: true, name: true, email: true } },
    },
  });

  return {
    outcome: "ok",
    patientPathway: nextPp,
    fromStageId,
    transitionId: createdTransition.id,
    documents,
  };
}
