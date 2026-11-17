import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { loadPatientPortalDetailPayload } from "@/application/use-cases/patient-portal/load-patient-portal-detail";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;
  const portal = portalCtx.data.portal;

  const url = new URL(request.url);
  const parsedQ = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }
  const { page, limit } = parsedQ.data;

  const result = await loadPatientPortalDetailPayload({
    tenantId: portal.tenantId,
    clientId: portal.clientId,
    page,
    limit,
  });
  if (!result) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  return jsonSuccess(result.body);
}
