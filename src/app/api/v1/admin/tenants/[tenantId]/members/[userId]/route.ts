import { withSessionRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { REMOVE_TENANT_MEMBER_ERRORS, UPDATE_TENANT_MEMBER_ERRORS } from "@/lib/api/error-tables/admin";
import { jsonSuccess } from "@/lib/api-response";
import { assertTenantAdminOrSuper } from "@/lib/auth/guards";
import { patchMemberRoleBodySchema } from "@/lib/validators/profile";
import { runRemoveTenantMember } from "@/application/use-cases/admin/remove-tenant-member";
import { runUpdateTenantMember } from "@/application/use-cases/admin/update-tenant-member";

export const dynamic = "force-dynamic";

type MemberParams = { tenantId: string; userId: string };

export const PATCH = withSessionRoute<MemberParams>(async ({ request, session, apiT, params }) => {
  const { tenantId, userId } = params;

  const forbidden = await assertTenantAdminOrSuper(session, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const parsed = await parseJsonBody(request, patchMemberRoleBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runUpdateTenantMember({
    tenantId,
    userId,
    body: parsed.data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, UPDATE_TENANT_MEMBER_ERRORS, apiT);
  }

  return jsonSuccess({
    member: result.member,
  });
});

/** Remove apenas a membership (não apaga o usuário global). */
export const DELETE = withSessionRoute<MemberParams>(async ({ request, session, apiT, params }) => {
  const { tenantId, userId } = params;

  const forbidden = await assertTenantAdminOrSuper(session, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const result = await runRemoveTenantMember({ tenantId, userId });

  if (!result.ok) {
    return mapUseCaseError(result.code, REMOVE_TENANT_MEMBER_ERRORS, apiT);
  }

  return jsonSuccess({ message: apiT("success.memberRemoved") });
});
