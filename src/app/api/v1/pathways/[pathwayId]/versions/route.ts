import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATHWAY_VERSION_CREATE_ERRORS } from "@/lib/api/error-tables/pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { postPathwayVersionBodySchema } from "@/lib/validators/pathway";
import { runCreatePathwayVersionDraft } from "@/application/use-cases/pathway/create-pathway-version-draft";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, tenantId, apiT, params }) => {
  const { pathwayId } = params;

  const parsed = await parseJsonBody(request, postPathwayVersionBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runCreatePathwayVersionDraft({
    tenantId,
    pathwayId,
    data: parsed.data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, PATHWAY_VERSION_CREATE_ERRORS, apiT);
  }

  return jsonSuccess(
    {
      version: result.version,
    },
    { status: 201 },
  );
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
