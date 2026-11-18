import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonSuccess } from "@/lib/api-response";
import { countUnreadNotificationsWithClientScope } from "@/application/use-cases/notification/list-notifications-with-scope";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ session, tenantId }) => {
  const count = await countUnreadNotificationsWithClientScope(actorFromSession(session),
    tenantId,
    session.user.id,
  );

  return jsonSuccess({ count });
});
