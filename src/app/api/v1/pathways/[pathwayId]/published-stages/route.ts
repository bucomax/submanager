import { withTenantRoute } from "@/lib/api/route-handler";
import { resolvePublishedPathwayVersion } from "@/infrastructure/database/pathway-published";
import { jsonError, jsonSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

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
export const GET = withTenantRoute(async ({ tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const resolved = await resolvePublishedPathwayVersion(tenantId, pathwayId);
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
});
