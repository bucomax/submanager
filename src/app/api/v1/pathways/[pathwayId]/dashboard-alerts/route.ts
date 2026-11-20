import { logger } from "@/lib/observability/logger";
import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { createProcessThrottle } from "@/lib/api/process-throttle";
import { formatZodIssues } from "@/lib/api/zod-error";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { checkAndEmitSlaNotifications } from "@/infrastructure/notifications/sla-notification-check";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildKanbanClientWhereForActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { dashboardPathwayOpmeQuerySchema } from "@/lib/validators/kanban";
import { loadDashboardPathwayAlerts } from "@/application/use-cases/pathway/load-dashboard-pathway-alerts";
import { after } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SLA_CHECK_THROTTLE_SECONDS = 60;
/** Sem Redis o lock distribuído é no-op; este throttle por processo evita varrer a cada GET. */
const slaCheckProcessThrottle = createProcessThrottle(SLA_CHECK_THROTTLE_SECONDS * 1000);

const querySchema = dashboardPathwayOpmeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Alertas MVP: pacientes em estado **danger** (SLA crítico), ordenados por dias na etapa (piores primeiro). */
export const GET = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    opmeSupplierId: url.searchParams.get("opmeSupplierId") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }
  const { limit, opmeSupplierId } = parsed.data;

  const resolved = await resolvePublishedPathwayVersion(tenantId, pathwayId);
  if (resolved.outcome === "PATHWAY_NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }
  if (resolved.outcome === "NO_PUBLISHED_VERSION") {
    return jsonError("CONFLICT", apiT("errors.noPublishedVersion"), 409);
  }
  const { version } = resolved;

  const { tryAcquire } = await import("@/lib/api/distributed-lock");
  const slaThrottleKey = `sla-check:${pathwayId}:${version.id}`;
  const canRun =
    slaCheckProcessThrottle.tryRun(slaThrottleKey) && (await tryAcquire(slaThrottleKey, SLA_CHECK_THROTTLE_SECONDS));
  if (canRun) {
    after(() =>
      checkAndEmitSlaNotifications({
        tenantId,
        pathwayId,
        versionId: version.id,
      }).catch((err: unknown) => {
        logger.error("[sla-check] emit failed", {
          tenantId,
          pathwayId,
          versionId: version.id,
          err,
        });
      }),
    );
  }

  const clientWhere = await buildKanbanClientWhereForActor(actorFromSession(session),
    tenantId,
    "",
    opmeSupplierId,
  );

  const alerts = await loadDashboardPathwayAlerts({
    tenantId,
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
});
