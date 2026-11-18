import { getApiT } from "@/lib/api/i18n";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { runPatchPatientPortalProfile } from "@/application/use-cases/patient-portal/patch-patient-portal-profile";
import { patchPatientPortalProfileBodySchema } from "@/lib/validators/patient-portal-profile";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const apiT = await getApiT(request);
  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;
  const portal = portalCtx.data.portal;

  const parsed = await parseJsonBody(request, patchPatientPortalProfileBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const result = await runPatchPatientPortalProfile({
    tenantId: portal.tenantId,
    clientId: portal.clientId,
    patch: parsed.data,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
    }
    if (result.code === "CPF_INVALID") {
      return jsonError("VALIDATION_ERROR", apiT("errors.validationCpf11Digits"), 422);
    }
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  return jsonSuccess({ client: result.client });
}
