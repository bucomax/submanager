import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { loadConversationVisibilityWhere } from "@/application/use-cases/shared/load-client-visibility-scope";
import { sendConversationMessage } from "@/application/use-cases/conversations/send-conversation-message";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { sendMessageBodySchema } from "@/lib/validators/contacts";
import type { MessageDto } from "@/types/api/contacts-v1";

export const dynamic = "force-dynamic";

/** Envia uma mensagem outbound na conversa (real, via WhatsApp Cloud API quando o tenant estiver configurado). */
export const POST = withTenantRoute<{ id: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { id } = params;

  const parsed = await parseJsonBody(request, sendMessageBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await sendConversationMessage({
    tenantId,
    conversationId: id,
    actorUserId: session.user.id,
    body: parsed.data.body,
    visibility: await loadConversationVisibilityWhere(actorFromSession(session), tenantId),
  });

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
  }

  const dto: MessageDto = {
    id: result.message.id,
    direction: result.message.direction,
    type: result.message.type,
    body: result.message.body,
    status: result.message.status,
    createdAt: result.message.createdAt.toISOString(),
  };

  return jsonSuccess(dto, { status: 201 });
});
