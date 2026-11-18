import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { listNotificationsWithClientScope } from "@/application/use-cases/notification/list-notifications-with-scope";
import { notificationsListQuerySchema } from "@/lib/validators/notification";
import type { NotificationDto } from "@/types/api/notification-v1";

export const dynamic = "force-dynamic";

export const GET = withTenantRoute(async ({ request, session, tenantId }) => {
  const url = new URL(request.url);
  const parsed = notificationsListQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { limit, cursor, unreadOnly } = parsed.data;
  const userId = session.user.id;

  const { rows: page, nextCursor } = await listNotificationsWithClientScope({
    actor: actorFromSession(session),
    tenantId,
    userId,
    limit,
    cursor,
    unreadOnly,
  });

  const data: NotificationDto[] = page.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    metadata: n.metadata as Record<string, unknown> | null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  return jsonSuccess({ data, nextCursor });
});
