import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

function serializeStage(s: {
  id: string;
  stageKey: string;
  name: string;
  sortOrder: number;
  patientMessage: string | null;
  alertWarningDays: number | null;
  alertCriticalDays: number | null;
  defaultAssigneeUserId: string | null;
  defaultAssigneeUserIds: string[];
}) {
  return {
    id: s.id,
    stageKey: s.stageKey,
    name: s.name,
    sortOrder: s.sortOrder,
    patientMessage: s.patientMessage,
    alertWarningDays: s.alertWarningDays,
    alertCriticalDays: s.alertCriticalDays,
    defaultAssigneeUserId: s.defaultAssigneeUserId,
    defaultAssigneeUserIds: s.defaultAssigneeUserIds,
  };
}

/** Fase 0: etapas da versão publicada (ordem Kanban / timeline). */
export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { pathwayId } = await ctx.params;

  const resolved = await resolvePublishedPathwayVersion(tenantCtx.tenantId, pathwayId);
  if (resolved.outcome === "PATHWAY_NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }
  if (resolved.outcome === "NO_PUBLISHED_VERSION") {
    return jsonError("CONFLICT", apiT("errors.noPublishedVersion"), 409);
  }

  const { version } = resolved;

  return jsonSuccess({
    pathwayId,
    version: {
      id: version.id,
      version: version.version,
      published: version.published,
      stages: version.stages.map(serializeStage),
    },
  });
}
