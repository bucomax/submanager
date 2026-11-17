import type { Prisma } from "@prisma/client";

import { runCreateClient, type CreateClientBody } from "@/application/use-cases/client/create-client";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
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
  /** Escopo de visibilidade do usuário sobre conversas (`{}` = sem restrição). */
  visibility: Prisma.ConversationWhereInput;
}): Promise<ConvertConversationToClientResult> {
  const { tenantId, conversationId, actorUserId, data, visibility } = params;

  const conversation = await conversationPrismaRepository.findVisibleLink(
    tenantId,
    conversationId,
    visibility,
  );
  if (!conversation) {
    return { ok: false, reason: "conversation_not_found" };
  }
  if (conversation.clientId) {
    return { ok: false, reason: "already_linked" };
  }

  const { client } = await runCreateClient({ tenantId, actorUserId, data });
  const linked = await conversationPrismaRepository.linkClient(tenantId, conversationId, client.id);
  if (!linked) {
    // Outro convert vinculou primeiro: desfaz o paciente duplicado recém-criado.
    await clientPrismaRepository.delete(tenantId, client.id, actorUserId);
    return { ok: false, reason: "already_linked" };
  }

  return { ok: true, client };
}
