import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATCH_CHECKLIST_ITEM_ERRORS } from "@/lib/api/error-tables/patient-pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { isPatientPathwayVisibleToActor } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchPatientChecklistItemBodySchema } from "@/lib/validators/patient-pathway-checklist";
import { runPatchPatientChecklistItem } from "@/application/use-cases/patient-pathway/patch-checklist-item";

export const dynamic = "force-dynamic";

export const PATCH = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const parsed = await parseJsonBody(request, patchPatientChecklistItemBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { patientPathwayId, itemId } = params;

  if (!(await isPatientPathwayVisibleToActor(actorFromSession(session), tenantId, patientPathwayId))) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayNotFound"), 404);
  }

  const result = await runPatchPatientChecklistItem({
    tenantId,
    actorUserId: session.user.id,
    patientPathwayId,
    itemId,
    body: parsed.data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, PATCH_CHECKLIST_ITEM_ERRORS, apiT);
  }

  return jsonSuccess({
    item: result.item,
  });
});
