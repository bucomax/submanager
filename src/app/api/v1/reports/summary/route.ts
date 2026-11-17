import { generatePathwaySummary } from "@/application/use-cases/report/generate-pathway-summary";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { reportsSummaryQuerySchema } from "@/lib/validators/reports";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const url = new URL(request.url);
  const parsed = reportsSummaryQuerySchema.safeParse({
    periodDays: url.searchParams.get("periodDays") ?? undefined,
    pathwayId: url.searchParams.get("pathwayId") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { periodDays, pathwayId, opmeSupplierId, page, limit } = parsed.data;

  const scope = await loadTenantMembershipClientScope(
    auth.session!.user.id,
    tenantCtx.tenantId,
    auth.session!.user.globalRole,
  );

  const data = await generatePathwaySummary({
    tenantId: tenantCtx.tenantId,
    periodDays,
    pathwayId,
    opmeSupplierId,
    page,
    limit,
    scope,
    viewerUserId: auth.session!.user.id,
  });

  return jsonSuccess(data);
}
