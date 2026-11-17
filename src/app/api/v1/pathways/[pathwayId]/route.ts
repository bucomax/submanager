import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { patchPathwayBodySchema } from "@/lib/validators/pathway";
import {
  getCarePathwayDetail,
  runDeleteCarePathway,
  runPatchCarePathway,
} from "@/application/use-cases/pathway/manage-care-pathway";

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

  const { pathwayId } = await ctx.params;
  const row = await getCarePathwayDetail(tenantCtx.tenantId, pathwayId);
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

  const { pathwayId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchPathwayBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

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
    tenantId: tenantCtx.tenantId,
    pathwayId,
    patch: data,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
    }
    return jsonError("VALIDATION_ERROR", apiT("errors.noFieldsToUpdate"), 422);
  }

  return jsonSuccess({
    pathway: result.pathway,
  });
}

export async function DELETE(request: Request, ctx: RouteCtx) {
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
  const result = await runDeleteCarePathway(tenantCtx.tenantId, pathwayId);

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.pathwayNotFound"), 404);
    }
    return jsonError("CONFLICT", apiT("errors.pathwayPatientsBlockDelete"), 409);
  }

  return jsonSuccess({ message: apiT("success.pathwayDeleted") });
}
