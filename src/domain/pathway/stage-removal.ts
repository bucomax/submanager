export type PublishedStageSnapshot = {
  id: string;
  stageKey: string;
  name: string;
  currentPatients: number;
};

export type StageRemovalAnalysis = {
  removedStageKeys: string[];
  removedWithPatients: PublishedStageSnapshot[];
  removedWithoutPatients: PublishedStageSnapshot[];
};

/** Etapas da versão publicada atual que somem na nova versão, separadas por terem pacientes ou não. */
export function analyzeStageRemoval(
  oldStages: PublishedStageSnapshot[],
  newStageKeys: ReadonlySet<string>,
): StageRemovalAnalysis {
  const removed = oldStages.filter((s) => !newStageKeys.has(s.stageKey));
  return {
    removedStageKeys: [...new Set(oldStages.map((s) => s.stageKey))].filter(
      (key) => !newStageKeys.has(key),
    ),
    removedWithPatients: removed.filter((s) => s.currentPatients > 0),
    removedWithoutPatients: removed.filter((s) => s.currentPatients === 0),
  };
}

export type OwnStageSnapshot = {
  id: string;
  stageKey: string;
  currentPatients: number;
  transitionsTo: number;
  transitionsFrom: number;
};

export type OwnStageAction =
  | { kind: "reuse" }
  | { kind: "delete" }
  | { kind: "move_to_published" }
  | { kind: "conflict" };

/**
 * Destino de uma etapa que já pertence à versão alvo (republicação de versão antiga):
 * - reaproveita se a chave continua e não colide com a publicada;
 * - apaga se não tem histórico;
 * - com histórico: move para a versão publicada anterior (preserva transições) ou conflita.
 */
export function classifyOwnStage(input: {
  own: OwnStageSnapshot;
  newStageKeys: ReadonlySet<string>;
  keyClashesWithPublished: boolean;
  hasPublishedVersion: boolean;
}): OwnStageAction {
  const { own, newStageKeys, keyClashesWithPublished, hasPublishedVersion } = input;
  const hasHistory = own.currentPatients + own.transitionsTo + own.transitionsFrom > 0;
  if (newStageKeys.has(own.stageKey) && !keyClashesWithPublished) return { kind: "reuse" };
  if (!hasHistory) return { kind: "delete" };
  if (newStageKeys.has(own.stageKey) || !hasPublishedVersion || keyClashesWithPublished) {
    return { kind: "conflict" };
  }
  return { kind: "move_to_published" };
}
