import { isPatientPathwayVisibleToSession } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { loadPatientPathwayDetail } from "@/application/use-cases/patient-pathway/load-patient-pathway-detail";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { patientPathwayId } = await ctx.params;

  if (!(await isPatientPathwayVisibleToSession(auth.session!, tenantCtx.tenantId, patientPathwayId))) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
  }

  const data = await loadPatientPathwayDetail({
    tenantId: tenantCtx.tenantId,
    patientPathwayId,
  });

  if (!data) {
    return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
  }

  return jsonSuccess(data);
}
