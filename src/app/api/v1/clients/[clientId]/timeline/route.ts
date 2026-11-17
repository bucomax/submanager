import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { loadStaffClientTimelinePage } from "@/application/use-cases/client/load-staff-client-timeline-page";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { clientTimelineQuerySchema } from "@/lib/validators/client-timeline-query";
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

  const url = new URL(request.url);
  const parsedQ = clientTimelineQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    categories: url.searchParams.get("categories") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }

  const { clientId } = await ctx.params;
  const { page, limit, categories } = parsedQ.data;

  const client = await findTenantClientVisibleToSession(auth.session!, tenantCtx.tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
  }

  const categoryFilter =
    categories != null && categories.length > 0 ? new Set(categories) : null;

  const data = await loadStaffClientTimelinePage({
    tenantId: tenantCtx.tenantId,
    clientId,
    page,
    limit,
    categoryFilter,
  });
  return jsonSuccess(data);
}
