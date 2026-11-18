import { getApiT } from "@/lib/api/i18n";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { postPatientPortalSessionPasswordBodySchema } from "@/lib/validators/patient-portal";
import { runSetPatientPortalSessionPassword } from "@/application/use-cases/patient-portal/set-patient-portal-session-password";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;
  const portal = portalCtx.data.portal;

  const parsed = await parseJsonBody(request, postPatientPortalSessionPasswordBodySchema, apiT);
  if (parsed.response) return parsed.response;

  const { newPassword, currentPassword } = parsed.data;

  const result = await runSetPatientPortalSessionPassword({
    tenantId: portal.tenantId,
    clientId: portal.clientId,
    newPassword,
    currentPassword,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
    }
    if (result.code === "CURRENT_REQUIRED") {
      return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalPasswordCurrentRequired"), 422);
    }
    return jsonError("UNAUTHORIZED", apiT("errors.patientPortalPasswordCurrentWrong"), 401);
  }

  return jsonSuccess({ ok: true });
}
