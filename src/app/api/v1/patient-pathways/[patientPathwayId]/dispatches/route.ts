import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { isPatientPathwayVisibleToActor } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { listChannelDispatchesForPatientPathway } from "@/application/use-cases/patient-pathway/list-channel-dispatches";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ session, tenantId, apiT, params }) => {
  const { patientPathwayId } = params;

  if (!(await isPatientPathwayVisibleToActor(actorFromSession(session), tenantId, patientPathwayId))) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
  }

  const dispatches = await listChannelDispatchesForPatientPathway({
    tenantId,
    patientPathwayId,
  });
  if (!dispatches) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
  }

  return jsonSuccess({ dispatches });
});
