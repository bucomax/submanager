import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { PATHWAY_VERSION_LOOKUP_ERRORS } from "@/lib/api/error-tables/pathway";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import { postPathwayPublishPreviewBodySchema } from "@/lib/validators/pathway";
import { runPathwayPublishPreview } from "@/application/use-cases/pathway/run-pathway-publish-preview";

export const dynamic = "force-dynamic";

/**
 * Pré-visualização da publicação (mesmas regras do POST `…/publish`, sem efeitos).
 * Corpo opcional `{ "graphJson" }` para validar alterações ainda não salvas no rascunho.
 */
export const POST = withTenantRoute(async ({ request, tenantId, apiT, params }) => {
  const { pathwayId, versionId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = postPathwayPublishPreviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      joinTranslatedZodIssues(parsed.error, apiT as (key: string) => string),
      422,
    );
  }

  const result = await runPathwayPublishPreview({
    tenantId,
    pathwayId,
    versionId,
    graphJsonOverride: parsed.data.graphJson,
    apiT,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, PATHWAY_VERSION_LOOKUP_ERRORS, apiT);
  }

  return jsonSuccess({ preview: result.preview });
}, { role: "admin", forbiddenMessageKey: "errors.managePathwaysPermissionDenied" });
