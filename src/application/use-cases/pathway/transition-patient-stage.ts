import { defaultTransitionPatientStageDeps } from "@/infrastructure/composition/transition-patient-stage-deps";
import { postStageTransitionBodySchema } from "@/lib/validators/pathway";
import {
  transitionPatientStage,
  type TransitionPatientStageDeps,
  type TransitionPatientStageParams,
  type TransitionPatientStageResult,
} from "@/application/use-cases/pathway/transition-patient-stage.core";

export type {
  StageTransitionInput,
  TransitionPatientStageDeps,
  TransitionPatientStageErrorCode,
  TransitionPatientStageResult,
} from "@/application/use-cases/pathway/transition-patient-stage.core";

export { postStageTransitionBodySchema };

/**
 * Ponto de entrada de produção (usado pelas rotas): injeta as dependências reais.
 * A lógica vive em `transition-patient-stage.core.ts` e só depende de ports.
 */
export function runTransitionPatientStage(
  params: TransitionPatientStageParams,
  deps: TransitionPatientStageDeps = defaultTransitionPatientStageDeps,
): Promise<TransitionPatientStageResult> {
  return transitionPatientStage(params, deps);
}
