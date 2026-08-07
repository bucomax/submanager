import type { ConversationStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

const conversationWithRelations = {
  client: { select: { id: true, name: true } },
  assignedToUser: { select: { id: true, name: true } },
} as const;

const lastMessageOnly = {
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

export const conversationPrismaRepository = {
  /** Todas as conversas do tenant, com a última mensagem de cada uma para montar o preview do card. */
  async listByTenant(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId },
      include: { ...conversationWithRelations, ...lastMessageOnly },
      orderBy: { lastMessageAt: "desc" },
    });
  },

  /** Conversa do tenant com histórico completo de mensagens, ordenado do mais antigo ao mais recente. */
  async findByIdInTenant(tenantId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        ...conversationWithRelations,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  /** Move a conversa pra outra coluna do kanban (troca de status). Sempre escopado ao tenant. */
  async updateStatus(tenantId: string, conversationId: string, status: ConversationStatus) {
    const { count } = await prisma.conversation.updateMany({
      where: { id: conversationId, tenantId },
      data: { status },
    });
    return count > 0;
  },
};
