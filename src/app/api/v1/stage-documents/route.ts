import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { LINK_STAGE_DOCUMENT_ERRORS } from "@/lib/api/error-tables/pathway";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { postStageDocumentBodySchema } from "@/lib/validators/stage-document";
import { runLinkStageDocument } from "@/application/use-cases/pathway/link-stage-document";

export const dynamic = "force-dynamic";

/** Vincula um `FileAsset` do tenant a uma etapa publicada (pacote da etapa). */
export const POST = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postStageDocumentBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runLinkStageDocument({
    tenantId,
    pathwayStageId: parsed.data.pathwayStageId,
    fileAssetId: parsed.data.fileAssetId,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, LINK_STAGE_DOCUMENT_ERRORS, apiT);
  }

  return jsonSuccess(
    {
      stageDocument: {
        id: result.stageDocument.id,
        sortOrder: result.stageDocument.sortOrder,
        file: result.stageDocument.file,
      },
    },
    { status: 201 },
  );
}, { role: "admin" });
