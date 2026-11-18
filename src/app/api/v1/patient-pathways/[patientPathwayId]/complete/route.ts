import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { COMPLETE_PATIENT_PATHWAY_ERRORS } from "@/lib/api/error-tables/patient-pathway";
import { isPatientPathwayVisibleToActor } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runCompletePatientPathway } from "@/application/use-cases/patient-pathway/complete-patient-pathway";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ session, tenantId, apiT, params }) => {
  const { patientPathwayId } = params;

  if (!(await isPatientPathwayVisibleToActor(actorFromSession(session), tenantId, patientPathwayId))) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
  }

  const result = await runCompletePatientPathway({
    tenantId,
    actorUserId: session.user.id,
    patientPathwayId,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, COMPLETE_PATIENT_PATHWAY_ERRORS, apiT);
  }

  return jsonSuccess({
    patientPathway: result.patientPathway,
  });
});
