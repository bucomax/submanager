import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { dashboardPathwayOpmeQuerySchema } from "@/lib/validators/kanban";
import { loadDashboardPathwaySummary } from "@/application/use-cases/pathway/load-dashboard-pathway-summary";

export const dynamic = "force-dynamic";

/** Métricas dos 4 cards do dashboard (totais por faixa SLA) para uma jornada com versão publicada. */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const url = new URL(request.url);
  const parsedOpme = dashboardPathwayOpmeQuerySchema.safeParse({
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsedOpme.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedOpme.error), 422);
  }
  const { opmeSupplierId } = parsedOpme.data;

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
    "",
    opmeSupplierId,
  );

  const summary = await loadDashboardPathwaySummary({
    tenantId,
    pathwayId,
    version,
    clientWhere,
  });

  return jsonSuccess({
    pathwayId,
    version: summary.versionMeta,
    totals: summary.totals,
  });
});
