import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { joinTranslatedZodIssues } from "@/lib/api/zod-i18n";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postPathwayPublishPreviewBodySchema } from "@/lib/validators/pathway";
import { runPathwayPublishPreview } from "@/application/use-cases/pathway/run-pathway-publish-preview";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

/**
 * Pré-visualização da publicação (mesmas regras do POST `…/publish`, sem efeitos).
 * Corpo opcional `{ "graphJson" }` para validar alterações ainda não salvas no rascunho.
 */
export async function POST(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;
  const adminErr = await assertTenantAdminOrSuper(
    auth.session!,
    tenantCtx.tenantId,
    request,
    apiT,
    "errors.managePathwaysPermissionDenied",
  );
  if (adminErr) return adminErr;

  const { pathwayId, versionId } = await ctx.params;

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
    tenantId: tenantCtx.tenantId,
    pathwayId,
    versionId,
    graphJsonOverride: parsed.data.graphJson,
    apiT,
  });

  if (!result.ok) {
    if (result.code === "PATHWAY_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
    }
    return jsonError("NOT_FOUND", apiT("errors.pathwayVersionNotFound"), 404);
  }

  return jsonSuccess({ preview: result.preview });
}
