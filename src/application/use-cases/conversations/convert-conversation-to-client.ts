import { runCreateClient, type CreateClientBody } from "@/application/use-cases/client/create-client";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { prisma } from "@/infrastructure/database/prisma";
import type { ClientDto } from "@/types/api/clients-v1";

export type ConvertConversationToClientResult =
  | { ok: true; client: ClientDto }
  | { ok: false; reason: "conversation_not_found" | "already_linked" };

/**
 * Converte um lead (Conversation sem clientId) num Client de verdade: cria o
 * paciente (mesmas regras do cadastro manual — e-mail/telefone obrigatórios
 * para adulto) e vincula à conversa. Usado pelo LeadPanel ao salvar um lead
 * ainda não cadastrado.
 */
export async function convertConversationToClient(params: {
  tenantId: string;
  conversationId: string;
  actorUserId: string;
  data: CreateClientBody;
}): Promise<ConvertConversationToClientResult> {
  const { tenantId, conversationId, actorUserId, data } = params;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, tenantId },
    select: { id: true, clientId: true },
  });
  if (!conversation) {
    return { ok: false, reason: "conversation_not_found" };
  }
  if (conversation.clientId) {
    return { ok: false, reason: "already_linked" };
  }

  const { client } = await runCreateClient({ tenantId, actorUserId, data });
  await conversationPrismaRepository.linkClient(tenantId, conversationId, client.id);

  return { ok: true, client };
}
