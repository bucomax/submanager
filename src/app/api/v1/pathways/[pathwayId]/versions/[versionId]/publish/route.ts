import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { runPublishPathwayVersionFlow } from "@/application/use-cases/pathway/publish-pathway";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function POST(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;
  const adminErr = await assertTenantAdminOrSuper(
    auth.session!,
    tenantCtx.tenantId,
    request,
    apiT,
    "errors.managePathwaysPermissionDenied",
  );
  if (adminErr) return adminErr;

  const { pathwayId, versionId } = await ctx.params;

  const outcome = await runPublishPathwayVersionFlow({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    versionId,
    apiT: apiT as (key: string, params?: Record<string, string>) => string,
  });

  if (!outcome.ok) {
    if ("preflightHttp" in outcome) {
      const h = outcome.preflightHttp;
      return jsonError(h.errorCode, h.message, h.status, h.details);
    }
    if (outcome.code === "PATHWAY_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
    }
    return jsonError("NOT_FOUND", apiT("errors.pathwayVersionNotFound"), 404);
  }

  return jsonSuccess(outcome.data);
}
