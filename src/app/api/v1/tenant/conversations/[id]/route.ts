import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchConversationStatusBodySchema } from "@/lib/validators/contacts";
import type {
  ConversationCardDto,
  ConversationDetailResponseData,
  MessageDto,
} from "@/types/api/contacts-v1";

export const dynamic = "force-dynamic";

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

/** Detalhe de uma conversa: card + histórico completo de mensagens. */
export const GET = withTenantRoute<{ id: string }>(async ({ session, tenantId, apiT, params }) => {
  const { id } = params;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const row = await conversationPrismaRepository.findByIdInTenant(tenantId, id, visibility);
  if (!row) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  const lastMessage = row.messages[row.messages.length - 1];

  const conversation: ConversationCardDto = {
    id: row.id,
    channel: row.channel,
    externalId: row.externalId,
    displayName: row.displayName,
    status: row.status,
    stageChangedAt: row.stageChangedAt.toISOString(),
    clientId: row.clientId,
    clientName: row.client?.name ?? null,
    assignedToUserId: row.assignedToUserId,
    assignedToUserName: row.assignedToUser?.name ?? null,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    lastMessagePreview: buildLastMessagePreview(lastMessage),
    unreadCount: row.unreadCount,
  };

  const messages: MessageDto[] = row.messages.map((message) => ({
    id: message.id,
    direction: message.direction,
    type: message.type,
    body: message.body,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  }));

  const payload: ConversationDetailResponseData = { conversation, messages };
  return jsonSuccess(payload);
});

/** Muda a etapa do lead (status da conversa). Sem efeito colateral em WhatsApp/mensagens. */
export const PATCH = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, patchConversationStatusBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const visibility = await loadConversationVisibilityWhere(actorFromSession(session), tenantId);
  const updated = await conversationPrismaRepository.updateStage(
    tenantId,
    id,
    parsed.data.status,
    visibility,
  );
  if (!updated) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  return jsonSuccess({ id, status: parsed.data.status });
});
