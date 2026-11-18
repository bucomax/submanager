import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { kanbanColumnPatientsQuerySchema } from "@/lib/validators/kanban";
import { loadKanbanColumnPatientsPage } from "@/application/use-cases/pathway/load-kanban-column-patients";

export const dynamic = "force-dynamic";

/** Paginação por página (`page` 1-based). Sem filtro `status` — use o Kanban agregado para filtrar por SLA. */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { pathwayId, stageId } = params;

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

  const result = await loadKanbanColumnPatientsPage({
    tenantId,
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
});
