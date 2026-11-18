import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonSuccess } from "@/lib/api-response";
import { listTenantMembersForPicker } from "@/application/use-cases/tenant/list-tenant-members-for-picker";

export const dynamic = "force-dynamic";

/** Lista membros do tenant ativo (picker de responsável, etc.). */
export const GET = withTenantRoute(async ({ tenantId }) => {
  const members = await listTenantMembersForPicker({ tenantId });

  return jsonSuccess({ members });
});
