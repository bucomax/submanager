import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { getCachedPathwaysList } from "@/infrastructure/cache/cached-pathways-list";
import { jsonSuccess } from "@/lib/api-response";
import { postPathwayBodySchema } from "@/lib/validators/pathway";
import { runCreateCarePathway } from "@/application/use-cases/pathway/create-care-pathway";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ tenantId }) => {
  const data = await getCachedPathwaysList(tenantId);
  return jsonSuccess(data);
});

export const POST = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postPathwayBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const pathway = await runCreateCarePathway({
    tenantId,
    name: parsed.data.name,
    description: parsed.data.description,
  });

  return jsonSuccess(
    {
      pathway,
    },
    { status: 201 },
  );
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
