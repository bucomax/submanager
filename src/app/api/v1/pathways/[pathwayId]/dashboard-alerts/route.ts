import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { checkAndEmitSlaNotifications } from "@/infrastructure/notifications/sla-notification-check";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { getActiveTenantIdOr400, requireSessionOr401 } from "@/lib/auth/guards";
import { dashboardPathwayOpmeQuerySchema } from "@/lib/validators/kanban";
import { loadDashboardPathwayAlerts } from "@/application/use-cases/pathway/load-dashboard-pathway-alerts";
import { after } from "next/server";
import { z } from "zod";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

const querySchema = dashboardPathwayOpmeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Alertas MVP: pacientes em estado **danger** (SLA crítico), ordenados por dias na etapa (piores primeiro). */
export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const { pathwayId } = await ctx.params;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }
  const { limit, opmeSupplierId } = parsed.data;

  const resolved = await resolvePublishedPathwayVersion(tenantCtx.tenantId, pathwayId);
  if (resolved.outcome === "PATHWAY_NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }
  if (resolved.outcome === "NO_PUBLISHED_VERSION") {
    return jsonError("CONFLICT", apiT("errors.noPublishedVersion"), 409);
  }
  const { version } = resolved;

  const { tryAcquire } = await import("@/lib/api/distributed-lock");
  const slaThrottleKey = `sla-check:${pathwayId}:${version.id}`;
  const canRun = await tryAcquire(slaThrottleKey, 60);
  if (canRun) {
    after(() =>
      checkAndEmitSlaNotifications({
        tenantId: tenantCtx.tenantId,
        pathwayId,
        versionId: version.id,
      }).catch((err: unknown) => {
        console.error("[sla-check] emit failed", {
          tenantId: tenantCtx.tenantId,
          pathwayId,
          versionId: version.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    );
  }

  const clientWhere = await buildKanbanClientWhereForSession(
    auth.session!,
    tenantCtx.tenantId,
    "",
    opmeSupplierId,
  );

  const alerts = await loadDashboardPathwayAlerts({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    version,
    clientWhere,
    limit,
  });

  return jsonSuccess({
    pathwayId,
    data: alerts.data,
    pagination: alerts.pagination,
  });
}
