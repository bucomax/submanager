import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  getPathwayVersionForTenant,
  updateDraftPathwayVersionForTenant,
} from "@/infrastructure/database/pathway-version";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchPathwayVersionBodySchema } from "@/lib/validators/pathway";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId, apiT, params }) => {
  const { pathwayId, versionId } = params;

  const row = await getPathwayVersionForTenant({
    tenantId,
    pathwayId,
    versionId,
  });
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.pathwayOrVersionNotFound"), 404);
  }

  return jsonSuccess({
    version: {
      id: row.id,
      pathwayId: row.pathwayId,
      version: row.version,
      published: row.published,
      graphJson: row.graphJson,
      createdAt: row.createdAt.toISOString(),
    },
  });
});

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT, params }) => {
  const { pathwayId, versionId } = params;

  const parsed = await parseJsonBody(request, patchPathwayVersionBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const row = await updateDraftPathwayVersionForTenant({
    tenantId,
    pathwayId,
    versionId,
    graphJson: parsed.data.graphJson as object,
  });
  if (row === "NOT_FOUND") {
    return jsonError("NOT_FOUND", apiT("errors.pathwayOrVersionNotFound"), 404);
  }
  if (row === "CONFLICT") {
    return jsonError("CONFLICT", apiT("errors.publishedVersionCannotEdit"), 409);
  }

  return jsonSuccess({
    version: {
      id: row.id,
      pathwayId: row.pathwayId,
      version: row.version,
      published: row.published,
      graphJson: row.graphJson,
      createdAt: row.createdAt.toISOString(),
    },
  });
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
