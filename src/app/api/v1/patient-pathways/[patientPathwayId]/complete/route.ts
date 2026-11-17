import { isPatientPathwayVisibleToSession } from "@/application/use-cases/shared/is-patient-pathway-visible";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { runCompletePatientPathway } from "@/application/use-cases/patient-pathway/complete-patient-pathway";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: RouteCtx) {
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

  const result = await runCompletePatientPathway({
    tenantId: tenantCtx.tenantId,
    actorUserId: auth.session!.user.id,
    patientPathwayId,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.patientPathwayInstanceNotFound"), 404);
    }
    return jsonError("CONFLICT", apiT("errors.pathwayAlreadyCompleted"), 409);
  }

  return jsonSuccess({
    patientPathway: result.patientPathway,
  });
}
