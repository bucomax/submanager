import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { getActiveTenantIdOr400, requireSessionOr401 } from "@/lib/auth/guards";
import { listNotificationsWithClientScope } from "@/application/use-cases/notification/list-notifications-with-scope";
import { notificationsListQuerySchema } from "@/lib/validators/notification";
import type { NotificationDto } from "@/types/api/notification-v1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

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
  const userId = auth.session!.user.id;

  const { rows: page, nextCursor } = await listNotificationsWithClientScope({
    session: auth.session!,
    tenantId: tenantCtx.tenantId,
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
}
