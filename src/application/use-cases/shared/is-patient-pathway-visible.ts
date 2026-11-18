import type { Actor } from "@/domain/auth/actor";

import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";

import {
  loadTenantMembershipClientScope,
  mergeClientWhereWithVisibility,
} from "./load-client-visibility-scope";

/**
 * `true` se o `PatientPathway` existe no tenant e o paciente está no escopo do usuário.
 * `false` cobre inexistente e fora de escopo (handler responde 404 sem vazar existência).
 */
export async function isPatientPathwayVisibleToActor(
  actor: Actor,
  tenantId: string,
  patientPathwayId: string,
): Promise<boolean> {
  const scope = await loadTenantMembershipClientScope(
    actor.userId,
    tenantId,
    actor.globalRole,
  );
  return patientPathwayPrismaRepository.existsWithClientWhere(
    tenantId,
    patientPathwayId,
    mergeClientWhereWithVisibility({ tenantId }, scope, actor.userId),
  );
}
