import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { generatePathwaySummary } from "@/application/use-cases/report/generate-pathway-summary";
import { loadTenantMembershipClientScope } from "@/application/use-cases/shared/load-client-visibility-scope";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { reportsSummaryQuerySchema } from "@/lib/validators/reports";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, session, tenantId }) => {
  const url = new URL(request.url);
  const parsed = reportsSummaryQuerySchema.safeParse({
    periodDays: url.searchParams.get("periodDays") ?? undefined,
    pathwayId: url.searchParams.get("pathwayId") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { periodDays, pathwayId, opmeSupplierId, page, limit } = parsed.data;

  const scope = await loadTenantMembershipClientScope(
    session.user.id,
    tenantId,
    session.user.globalRole,
  );

  const data = await generatePathwaySummary({
    tenantId,
    periodDays,
    pathwayId,
    opmeSupplierId,
    page,
    limit,
    scope,
    viewerUserId: session.user.id,
  });

  return jsonSuccess(data);
});
