import { formatZodIssues } from "@/lib/api/zod-error";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { kanbanColumnPatientsQuerySchema } from "@/lib/validators/kanban";
import { loadKanbanColumnPatientsPage } from "@/application/use-cases/pathway/load-kanban-column-patients";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Paginação por página (`page` 1-based). Sem filtro `status` — use o Kanban agregado para filtrar por SLA. */
export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { pathwayId, stageId } = await ctx.params;

  const url = new URL(request.url);
  const parsed = kanbanColumnPatientsQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }
  const { search: searchRaw, limit, page, opmeSupplierId } = parsed.data;
  const search = searchRaw ?? "";

  const resolved = await resolvePublishedPathwayVersion(tenantCtx.tenantId, pathwayId);
  if (resolved.outcome === "PATHWAY_NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }
  if (resolved.outcome === "NO_PUBLISHED_VERSION") {
    return jsonError("CONFLICT", apiT("errors.noPublishedVersion"), 409);
  }
  const { version } = resolved;

  const clientWhere = await buildKanbanClientWhereForSession(
    auth.session!,
    tenantCtx.tenantId,
    search,
    opmeSupplierId,
  );

  const result = await loadKanbanColumnPatientsPage({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    stageId,
    version,
    clientWhere,
    page,
    limit,
  });

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.stageNotInPublishedVersion"), 404);
  }

  return jsonSuccess({
    data: result.data,
    pagination: result.pagination,
  });
}
