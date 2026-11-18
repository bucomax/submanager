import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonSuccess } from "@/lib/api-response";
import { markAllUnreadNotificationsReadWithClientScope } from "@/application/use-cases/notification/list-notifications-with-scope";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ session, tenantId }) => {
  const updated = await markAllUnreadNotificationsReadWithClientScope(actorFromSession(session),
    tenantId,
    session.user.id,
  );

  return jsonSuccess({ updated });
});
