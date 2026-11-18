import type { TransitionPatientStageDeps } from "@/application/use-cases/pathway/transition-patient-stage.core";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { stageTransitionPrismaStore } from "@/infrastructure/repositories/stage-transition.repository";
import {
  distributedLock,
  tenantListCache,
  transitionPostCommitDeps,
} from "@/infrastructure/composition/shared-adapters";

export const defaultTransitionPatientStageDeps: TransitionPatientStageDeps = {
  store: stageTransitionPrismaStore,
  clients: clientPrismaRepository,
  lock: distributedLock,
  cache: tenantListCache,
  postCommit: transitionPostCommitDeps,
};
