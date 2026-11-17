import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postStageDocumentBodySchema } from "@/lib/validators/stage-document";
import { runLinkStageDocument } from "@/application/use-cases/pathway/link-stage-document";

export const dynamic = "force-dynamic";

/** Vincula um `FileAsset` do tenant a uma etapa publicada (pacote da etapa). */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId, request, apiT);
  if (adminBlock) return adminBlock;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postStageDocumentBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runLinkStageDocument({
    tenantId: tenantCtx.tenantId,
    pathwayStageId: parsed.data.pathwayStageId,
    fileAssetId: parsed.data.fileAssetId,
  });

  if (!result.ok) {
    if (result.code === "STAGE_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.stagePublishedNotFoundInTenant"), 404);
    }
    if (result.code === "FILE_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.fileNotFoundInTenant"), 404);
    }
    return jsonError("CONFLICT", apiT("errors.fileLinkedToStage"), 409);
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
}
