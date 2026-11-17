import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postPathwayVersionBodySchema } from "@/lib/validators/pathway";
import { runCreatePathwayVersionDraft } from "@/application/use-cases/pathway/create-pathway-version-draft";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

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

  const { pathwayId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postPathwayVersionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const result = await runCreatePathwayVersionDraft({
    tenantId: tenantCtx.tenantId,
    pathwayId,
    data: parsed.data,
  });

  if (!result.ok) {
    if (result.code === "PATHWAY_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
    }
    return jsonError("CONFLICT", apiT("errors.pathwayVersionConflict"), 409);
  }

  return jsonSuccess(
    {
      version: result.version,
    },
    { status: 201 },
  );
}
