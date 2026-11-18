import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { assertNotificationVisibleToClientScope } from "@/application/use-cases/notification/list-notifications-with-scope";
import { runMarkNotificationRead } from "@/application/use-cases/notification/mark-notification-read";
import { notificationPrismaRepository } from "@/infrastructure/repositories/notification.repository";

export const dynamic = "force-dynamic";

export const PATCH = withTenantRoute(async ({ session, tenantId, apiT, params }) => {
  const { notificationId } = params;
  const userId = session.user.id;

  const row = await notificationPrismaRepository.findById(tenantId, notificationId);
  if (!row || typeof row !== "object") {
    return jsonError("NOT_FOUND", apiT("errors.notificationNotFound"), 404);
  }
  const notification = row as { userId: string };
  if (notification.userId !== userId) {
    return jsonError("NOT_FOUND", apiT("errors.notificationNotFound"), 404);
  }

  const visible = await assertNotificationVisibleToClientScope(
    actorFromSession(session),
    tenantId,
    userId,
    row,
  );
  if (!visible) {
    return jsonError("NOT_FOUND", apiT("errors.notificationNotFound"), 404);
  }

  const result = await runMarkNotificationRead({
    tenantId,
    userId,
    notificationId,
  });
  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.notificationNotFound"), 404);
  }

  return jsonSuccess({ notification: result.notification });
});
