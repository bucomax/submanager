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
import { dashboardPathwayOpmeQuerySchema } from "@/lib/validators/kanban";
import { loadDashboardPathwaySummary } from "@/application/use-cases/pathway/load-dashboard-pathway-summary";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/** Métricas dos 4 cards do dashboard (totais por faixa SLA) para uma jornada com versão publicada. */
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
  const parsedOpme = dashboardPathwayOpmeQuerySchema.safeParse({
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsedOpme.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedOpme.error), 422);
  }
  const { opmeSupplierId } = parsedOpme.data;

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
    "",
    opmeSupplierId,
  );

  const summary = await loadDashboardPathwaySummary({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    version,
    clientWhere,
  });

  return jsonSuccess({
    pathwayId,
    version: summary.versionMeta,
    totals: summary.totals,
  });
}
