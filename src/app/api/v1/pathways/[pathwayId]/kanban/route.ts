import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { kanbanQuerySchema } from "@/lib/validators/kanban";
import { loadKanbanBoard } from "@/application/use-cases/pathway/load-kanban-board";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Fase 2: colunas + pacientes por etapa, com busca, filtro de status SLA e paginação por coluna (primeira página). */
export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { pathwayId } = await ctx.params;

  const url = new URL(request.url);
  const parsed = kanbanQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") || undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }
  const { search: searchRaw, status: statusFilter, limit, opmeSupplierId } = parsed.data;
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

  const board = await loadKanbanBoard({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    version,
    clientWhere,
    search,
    statusFilter,
    limit,
    opmeSupplierId,
  });

  return jsonSuccess({
    pathwayId,
    version: {
      id: version.id,
      version: version.version,
      published: version.published,
    },
    columns: board.columns,
    query: board.query,
  });
}
