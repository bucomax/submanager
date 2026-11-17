import { formatZodIssues } from "@/lib/api/zod-error";
import { buildPagination } from "@/lib/api/pagination";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { listStaffClientFilesPage } from "@/application/use-cases/client/list-staff-client-files-page";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";
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
  const parsedQ = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }
  const { page, limit } = parsedQ.data;

  const { clientId } = await ctx.params;

  const client = await findTenantClientVisibleToSession(auth.session!, tenantCtx.tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const { totalItems, data } = await listStaffClientFilesPage({
    tenantId: tenantCtx.tenantId,
    clientId,
    page,
    limit,
  });

  return jsonSuccess({
    data,
    pagination: buildPagination(page, limit, totalItems),
  });
}
