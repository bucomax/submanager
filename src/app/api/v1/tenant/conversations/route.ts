import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { jsonSuccess } from "@/lib/api-response";
import type {
  ConversationChannel,
  ConversationListItemDto,
  ConversationStatus,
  ConversationsListResponseData,
} from "@/types/api/contacts-v1";

export const dynamic = "force-dynamic";

const VALID_CHANNELS: ConversationChannel[] = ["whatsapp", "instagram"];
const VALID_STATUSES: ConversationStatus[] = ["new", "in_progress", "qualified", "discarded"];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const PREVIEW_MAX_LENGTH = 80;

function buildLastMessagePreview(lastMessage: { type: string; body: string | null } | undefined): string | null {
  if (!lastMessage) return null;
  if (lastMessage.body) {
    return lastMessage.body.length > PREVIEW_MAX_LENGTH
      ? `${lastMessage.body.slice(0, PREVIEW_MAX_LENGTH)}…`
      : lastMessage.body;
  }
  return lastMessage.type !== "text" ? "[mídia]" : null;
}

/** Lista paginada de conversas do tenant — usada pela coluna 1 da tela de Conversas. */
export const GET = withTenantRoute(async ({ request, session, tenantId }) => {
  const url = new URL(request.url);
  const channelParam = url.searchParams.get("channel");
  const statusParam = url.searchParams.get("status");
  const q = url.searchParams.get("q")?.trim() || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;
  const limitParam = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const channel = VALID_CHANNELS.find((c) => c === channelParam);
  const status = VALID_STATUSES.find((s) => s === statusParam);

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const { items, nextCursor, totalItems } = await conversationPrismaRepository.listByTenantPaged(
    tenantId,
    { channel, status, q, cursor, limit, visibility },
  );

  const data: ConversationListItemDto[] = items.map((row) => ({
    id: row.id,
    channel: row.channel,
    externalId: row.externalId,
    displayName: row.displayName,
    status: row.status,
    clientId: row.clientId,
    clientName: row.client?.name ?? null,
    assignedToUserId: row.assignedToUserId,
    assignedToUserName: row.assignedToUser?.name ?? null,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    lastMessagePreview: buildLastMessagePreview(row.messages[0]),
    unreadCount: row.unreadCount,
    stageChangedAt: row.stageChangedAt.toISOString(),
  }));

  const payload: ConversationsListResponseData = { data, nextCursor, totalItems };
  return jsonSuccess(payload);
});
