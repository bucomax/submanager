import { withSessionRoute } from "@/lib/api/route-handler";
import { listTenantsForUserContext } from "@/infrastructure/database/tenant-context";
import { jsonSuccess } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** Lista tenants do contexto do usuário (super_admin vê todos). */
export const GET = withSessionRoute(async ({ session }) => {
  const tenants = await listTenantsForUserContext({
    userId: session.user.id,
    isSuperAdmin: session.user.globalRole === "super_admin",
  });

  return jsonSuccess({
    tenants,
  });
});
