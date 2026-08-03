import { getApiT } from "@/lib/api/i18n";
import { rateLimit } from "@/lib/api/rate-limit";
import { getActiveTenantIdOr400, requireSessionOr401 } from "@/lib/auth/guards";
import {
  countUnreadNotificationsWithClientScope,
  isNotificationMetadataVisibleToViewer,
} from "@/application/use-cases/notification/list-notifications-with-scope";
import { SSE_NOTIFICATIONS_CHANNEL } from "@/infrastructure/queue/constants";
import {
  acquireSseSlot,
  createSubscriberConnection,
  isRedisEnabled,
  releaseSseSlot,
  tripRedisCircuit,
} from "@/infrastructure/notifications/sse-connection-slot";
import type IORedis from "ioredis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const session = auth.session!;
  const userId = session.user.id;
  const tenantId = tenantCtx.tenantId;

  // Cada conexão SSE segura um handler — preset dedicado, mais apertado que `api`.
  const limited = await rateLimit("sse", userId);
  if (limited) return limited;

  if (!isRedisEnabled()) {
    return Response.json(
      { success: false, error: { code: "SSE_UNAVAILABLE", message: "Real-time stream requires Redis." } },
      { status: 501 },
    );
  }

  const slot = await acquireSseSlot(userId);
  if (slot === "redis_unavailable") {
    return Response.json(
      {
        success: false,
        error: {
          code: "SSE_UNAVAILABLE",
          message:
            "Stream em tempo real indisponível (Redis ausente ou circuito aberto). Notificações continuam via API; suba o Redis ou limpe REDIS_URL para modo sem SSE.",
        },
      },
      { status: 503 },
    );
  }
  if (slot === "limit") {
    return Response.json(
      { success: false, error: { code: "SSE_LIMIT", message: "Too many open connections." } },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();
  let subscriber: IORedis | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let slotReleased = false;

  function cleanup() {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (subscriber) {
      subscriber.unsubscribe(SSE_NOTIFICATIONS_CHANNEL).catch(() => {});
      subscriber.disconnect();
      subscriber = null;
    }
    if (!slotReleased) {
      slotReleased = true;
      void releaseSseSlot(userId);
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      }

      const initialCount = await countUnreadNotificationsWithClientScope(session, tenantId, userId);
      send("unread-count", { count: initialCount });

      subscriber = createSubscriberConnection();
      if (!subscriber) {
        cleanup();
        controller.close();
        return;
      }

      try {
        await subscriber.subscribe(SSE_NOTIFICATIONS_CHANNEL);
      } catch {
        tripRedisCircuit();
        cleanup();
        controller.close();
        return;
      }

      subscriber.on("message", (_channel: string, message: string) => {
        void (async () => {
          try {
            const parsed = JSON.parse(message) as {
              userId: string;
              tenantId: string;
              notification: Record<string, unknown>;
            };
            if (parsed.userId !== userId || parsed.tenantId !== tenantId) return;

            const visible = await isNotificationMetadataVisibleToViewer({
              userId,
              globalRole: session.user.globalRole,
              tenantId,
              metadata: parsed.notification.metadata,
            });
            if (!visible) return;

            send("notification", parsed.notification);
          } catch {
            /* malformed */
          }
        })();
      });

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, 30_000);
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
