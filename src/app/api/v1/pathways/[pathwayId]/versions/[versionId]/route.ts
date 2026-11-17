import {
  getPathwayVersionForTenant,
  updateDraftPathwayVersionForTenant,
} from "@/infrastructure/database/pathway-version";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { patchPathwayVersionBodySchema } from "@/lib/validators/pathway";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function GET(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { pathwayId, versionId } = await ctx.params;

  const row = await getPathwayVersionForTenant({
    tenantId: tenantCtx.tenantId,
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
}

export async function PATCH(request: Request, ctx: RouteCtx) {
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
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchPathwayVersionBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const row = await updateDraftPathwayVersionForTenant({
    tenantId: tenantCtx.tenantId,
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
}
