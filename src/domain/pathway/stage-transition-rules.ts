export type PendingChecklistItem = { id: string; label: string };

/** Estado do `PatientPathway` re-lido dentro da transação. */
export type PatientPathwayStageState = {
  currentStageId: string;
  pathwayVersionId: string;
  completedAt: Date | null;
};

export type StageTransitionPrecondition = "conflict" | "completed" | "already_in_target";

/**
 * Guardas de estado: a etapa/versão do paciente mudou (conflito), jornada concluída ou já na etapa alvo.
 * `null` = pode seguir para o gate de checklist.
 */
export function checkStageTransitionPreconditions(input: {
  fresh: PatientPathwayStageState | null;
  expectedPathwayVersionId: string;
  toStageId: string;
}): StageTransitionPrecondition | null {
  const { fresh, expectedPathwayVersionId, toStageId } = input;
  if (!fresh || fresh.pathwayVersionId !== expectedPathwayVersionId) return "conflict";
  if (fresh.completedAt) return "completed";
  if (fresh.currentStageId === toStageId) return "already_in_target";
  return null;
}

/** Mínimo de caracteres (após `trim`) da justificativa de um override forçado; igual ao validator da rota e à UI. */
export const OVERRIDE_REASON_MIN_LENGTH = 10;

export type ChecklistGateDecision =
  | { kind: "blocked"; pending: PendingChecklistItem[] }
  /** `force` com checklist obrigatório incompleto, mas sem justificativa suficiente: override inválido. */
  | { kind: "override_reason_required" }
  | { kind: "proceed"; forcedOverride: boolean; overrideReason: string | null };

/**
 * Itens obrigatórios pendentes bloqueiam a transição, exceto com `force` (override registrado).
 * O override exige justificativa (`OVERRIDE_REASON_MIN_LENGTH`) — invariante do domínio, independente do validator HTTP.
 * O motivo só é guardado quando houve override de fato.
 */
export function evaluateChecklistGate(input: {
  pending: PendingChecklistItem[];
  force?: boolean;
  overrideReason?: string | null;
}): ChecklistGateDecision {
  const { pending, force, overrideReason } = input;
  if (pending.length === 0) return { kind: "proceed", forcedOverride: false, overrideReason: null };
  if (!force) return { kind: "blocked", pending };

  const reason = overrideReason?.trim() ?? "";
  if (reason.length < OVERRIDE_REASON_MIN_LENGTH) return { kind: "override_reason_required" };
  return { kind: "proceed", forcedOverride: true, overrideReason: reason };
}
