import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { patchConversationStatusBodySchema } from "@/lib/validators/contacts";
import type {
  ConversationCardDto,
  ConversationDetailResponseData,
  MessageDto,
} from "@/types/api/contacts-v1";
import type { RouteCtx } from "@/types/api/route-context";

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
export async function GET(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  const row = await conversationPrismaRepository.findByIdInTenant(tenantCtx.tenantId!, id);
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
}

/** Move a conversa entre colunas do kanban (troca de status). Sem efeito colateral em WhatsApp/mensagens. */
export async function PATCH(request: Request, ctx: RouteCtx<{ id: string }>) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchConversationStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const updated = await conversationPrismaRepository.updateStatus(tenantCtx.tenantId!, id, parsed.data.status);
  if (!updated) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  return jsonSuccess({ id, status: parsed.data.status });
}
