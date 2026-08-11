import type { Message } from "@prisma/client";

import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { prisma } from "@/infrastructure/database/prisma";
import { whatsappOutbound } from "@/infrastructure/whatsapp/whatsapp-outbound";

export type SendConversationMessageInput = {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  body: string;
};

export type SendConversationMessageResult =
  | { ok: true; message: Message; sent: boolean }
  | { ok: false; reason: "conversation_not_found" };

/**
 * Persiste uma mensagem outbound na conversa e tenta o envio real via WhatsApp
 * Cloud API (só para canal `whatsapp`; Instagram fica só como registro local
 * — sem integração de envio nesta entrega). A mensagem é sempre gravada.
 * `status: "failed"` só quando a chamada à Cloud API de fato falhou
 * (`send_failed`) — tenant sem WhatsApp configurado é skip gracioso (mesmo
 * padrão do `whatsappDispatcher`), a mensagem fica `status: "sent"` (registro
 * local válido, só não foi transmitida ao canal externo).
 */
export async function sendConversationMessage(
  input: SendConversationMessageInput,
): Promise<SendConversationMessageResult> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: input.conversationId, tenantId: input.tenantId },
    include: { client: { select: { phone: true } } },
  });
  if (!conversation) {
    return { ok: false, reason: "conversation_not_found" };
  }

  const recipientPhone = conversation.client?.phone ?? conversation.externalId;
  const canAttemptSend = conversation.channel === "whatsapp" && Boolean(recipientPhone);

  const sendResult = canAttemptSend
    ? await whatsappOutbound.sendText({
        tenantId: input.tenantId,
        recipientPhone,
        text: input.body,
      })
    : ({ sent: false, reason: "tenant_not_configured" } as const);

  const trulyFailed = !sendResult.sent && sendResult.reason === "send_failed";
  const message = await conversationPrismaRepository.createMessage(
    input.tenantId,
    input.conversationId,
    {
      direction: "outbound",
      body: input.body,
      status: trulyFailed ? "failed" : "sent",
      actorUserId: input.actorUserId,
    },
  );
  // Conversa validada acima — createMessage só retorna null se o tenant não bater,
  // o que já foi checado; guarda extra só pro type narrowing do TS.
  if (!message) {
    return { ok: false, reason: "conversation_not_found" };
  }

  if (sendResult.sent) {
    await prisma.message.update({
      where: { id: message.id },
      data: { externalMessageId: sendResult.externalMessageId, deliveredAt: null },
    });
  } else if (sendResult.reason === "send_failed") {
    await prisma.message.update({
      where: { id: message.id },
      data: { errorDetail: sendResult.errorDetail },
    });
  }

  return { ok: true, message, sent: sendResult.sent };
}
