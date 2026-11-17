import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { assertTenantAdminOrSuper, requireSessionOr401 } from "@/lib/auth/guards";
import { patchMemberRoleBodySchema } from "@/lib/validators/profile";
import { runRemoveTenantMember } from "@/application/use-cases/admin/remove-tenant-member";
import { runUpdateTenantMember } from "@/application/use-cases/admin/update-tenant-member";

export const dynamic = "force-dynamic";

import type { RouteCtx } from "@/types/api/route-context";

export async function PATCH(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const { tenantId, userId } = await ctx.params;

  const forbidden = await assertTenantAdminOrSuper(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchMemberRoleBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runUpdateTenantMember({
    tenantId,
    userId,
    body: parsed.data,
  });

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
    }
    if (result.code === "MEMBER_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.memberNotFoundInTenant"), 404);
    }
    if (result.code === "USER_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.userNotFound"), 404);
    }
    if (result.code === "OPME_NOT_FOUND") {
      return jsonError("VALIDATION_ERROR", apiT("errors.opmeSupplierNotFound"), 422);
    }
    if (result.code === "LAST_ADMIN") {
      return jsonError("CONFLICT", apiT("errors.tenantMustHaveAdmin"), 409);
    }
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }

  return jsonSuccess({
    member: result.member,
  });
}

/** Remove apenas a membership (não apaga o usuário global). */
export async function DELETE(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const { tenantId, userId } = await ctx.params;

  const forbidden = await assertTenantAdminOrSuper(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const result = await runRemoveTenantMember({ tenantId, userId });

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
    }
    if (result.code === "MEMBER_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.memberNotFoundInTenant"), 404);
    }
    if (result.code === "LAST_ADMIN") {
      return jsonError("CONFLICT", apiT("errors.cannotRemoveOnlyAdmin"), 409);
    }
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }

  return jsonSuccess({ message: apiT("success.memberRemoved") });
}
