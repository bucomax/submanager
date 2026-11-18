import { withSessionRoute } from "@/lib/api/route-handler";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { assertTenantAdminOrSuper } from "@/lib/auth/guards";
import {
  listTenantMembersWithProfiles,
  tenantExistsById,
} from "@/application/use-cases/admin/list-tenant-members-with-profiles";

export const dynamic = "force-dynamic";

/** Lista membros ativos do tenant (usuário não deletado). */
export const GET = withSessionRoute<{ tenantId: string }>(async ({ request, session, apiT, params }) => {
  const { tenantId } = params;

  if (!(await tenantExistsById(tenantId))) {
    return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
  }

  const forbidden = await assertTenantAdminOrSuper(session, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const members = await listTenantMembersWithProfiles({ tenantId });

  return jsonSuccess({ members });
});
