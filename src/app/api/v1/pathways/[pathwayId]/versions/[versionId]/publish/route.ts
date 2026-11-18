import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATHWAY_VERSION_LOOKUP_ERRORS } from "@/lib/api/error-tables/pathway";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runPublishPathwayVersionFlow } from "@/application/use-cases/pathway/publish-pathway";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ tenantId, apiT, params }) => {
  const { pathwayId, versionId } = params;

  const outcome = await runPublishPathwayVersionFlow({
    tenantId,
    pathwayId,
    versionId,
    apiT: apiT as (key: string, params?: Record<string, string>) => string,
  });

  if (!outcome.ok) {
    if ("preflightHttp" in outcome) {
      const h = outcome.preflightHttp;
      return jsonError(h.errorCode, h.message, h.status, h.details);
    }
    if ("publishConflict" in outcome) {
      const c = outcome.publishConflict;
      if (c.code === "ALREADY_PUBLISHED") {
        return jsonError("ALREADY_PUBLISHED", apiT("errors.pathwayVersionAlreadyPublished"), 409);
      }
      if (c.code === "REMOVED_STAGES_WITH_PATIENTS") {
        const names = (c.stages ?? []).map((st) => st.name).join(", ");
        return jsonError("CONFLICT", apiT("errors.stagesHavePatients", { stages: names }), 409, {
          stages: c.stages,
        });
      }
      return jsonError("CONFLICT", apiT("errors.pathwayVersionStageKeyConflict"), 409);
    }
    return mapUseCaseError(outcome.code, PATHWAY_VERSION_LOOKUP_ERRORS, apiT);
  }

  return jsonSuccess(outcome.data);
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
