import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATHWAY_DELETE_ERRORS, PATHWAY_UPDATE_ERRORS } from "@/lib/api/error-tables/pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchPathwayBodySchema } from "@/lib/validators/pathway";
import {
  getCarePathwayDetail,
  runDeleteCarePathway,
  runPatchCarePathway,
} from "@/application/use-cases/pathway/manage-care-pathway";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId, apiT, params }) => {
  const { pathwayId } = params;
  const row = await getCarePathwayDetail(tenantId, pathwayId);
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
  }

  return jsonSuccess({
    pathway: {
      id: row.id,
      name: row.name,
      description: row.description,
      versions: row.versions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  });
});

export const PATCH = withTenantRoute(async ({ request, tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const parsed = await parseJsonBody(request, patchPathwayBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const data: { name?: string; description?: string | null } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) {
    data.description =
      parsed.data.description === null ? null : parsed.data.description.trim() || null;
  }
  if (Object.keys(data).length === 0) {
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  const result = await runPatchCarePathway({
    tenantId,
    pathwayId,
    patch: data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, PATHWAY_UPDATE_ERRORS, apiT);
  }

  return jsonSuccess({
    pathway: result.pathway,
  });
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });

export const DELETE = withTenantRoute(async ({ tenantId, apiT, params }) => {
  const { pathwayId } = params;
  const result = await runDeleteCarePathway(tenantId, pathwayId);

  if (!result.ok) {
    return mapUseCaseError(result.code, PATHWAY_DELETE_ERRORS, apiT);
  }

  return jsonSuccess({ message: apiT("success.pathwayDeleted") });
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
