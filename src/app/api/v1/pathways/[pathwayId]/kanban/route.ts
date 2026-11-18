import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { kanbanQuerySchema } from "@/lib/validators/kanban";
import { loadKanbanBoard } from "@/application/use-cases/pathway/load-kanban-board";

export const dynamic = "force-dynamic";

/** Fase 2: colunas + pacientes por etapa, com busca, filtro de status SLA e paginação por coluna (primeira página). */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const url = new URL(request.url);
  const parsed = kanbanQuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") || undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }
  const { search: searchRaw, status: statusFilter, limit, opmeSupplierId } = parsed.data;
  const search = searchRaw ?? "";

  const resolved = await resolvePublishedPathwayVersion(tenantId, pathwayId);
  if (resolved.outcome === "PATHWAY_NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }
  if (resolved.outcome === "NO_PUBLISHED_VERSION") {
    return jsonError("CONFLICT", apiT("errors.noPublishedVersion"), 409);
  }
  const { version } = resolved;

  const clientWhere = await buildKanbanClientWhereForActor(actorFromSession(session),
    tenantId,
    search,
    opmeSupplierId,
  );

  const board = await loadKanbanBoard({
    tenantId,
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
});
