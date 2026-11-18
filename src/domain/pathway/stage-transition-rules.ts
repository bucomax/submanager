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

export type ChecklistGateDecision =
  | { kind: "blocked"; pending: PendingChecklistItem[] }
  | { kind: "proceed"; forcedOverride: boolean; overrideReason: string | null };

/**
 * Itens obrigatórios pendentes bloqueiam a transição, exceto com `force` (override registrado).
 * O motivo só é guardado quando houve override de fato.
 */
export function evaluateChecklistGate(input: {
  pending: PendingChecklistItem[];
  force?: boolean;
  overrideReason?: string | null;
}): ChecklistGateDecision {
  const { pending, force, overrideReason } = input;
  if (pending.length > 0 && !force) return { kind: "blocked", pending };
  const forcedOverride = pending.length > 0 && Boolean(force);
  return {
    kind: "proceed",
    forcedOverride,
    overrideReason: forcedOverride ? (overrideReason?.trim() ?? "") || null : null,
  };
}
