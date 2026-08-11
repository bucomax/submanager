import type {
  ConversationChannel,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

const conversationWithRelations = {
  client: { select: { id: true, name: true, phone: true } },
  assignedToUser: { select: { id: true, name: true } },
} as const;

const lastMessageOnly = {
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} as const;

export type ListConversationsPagedOptions = {
  channel?: ConversationChannel;
  status?: ConversationStatus;
  q?: string;
  cursor?: string;
  limit: number;
};

export const conversationPrismaRepository = {
  /** Todas as conversas do tenant, com a última mensagem de cada uma para montar o preview do card. */
  async listByTenant(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId },
      include: { ...conversationWithRelations, ...lastMessageOnly },
      orderBy: { lastMessageAt: "desc" },
    });
  },

  /** Lista paginada (cursor) com filtros de canal/etapa/busca — usada pela tela de Conversas. */
  async listByTenantPaged(tenantId: string, opts: ListConversationsPagedOptions) {
    const where: Prisma.ConversationWhereInput = {
      tenantId,
      ...(opts.channel ? { channel: opts.channel } : {}),
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.q
        ? {
            OR: [
              { displayName: { contains: opts.q, mode: "insensitive" } },
              { client: { name: { contains: opts.q, mode: "insensitive" } } },
              {
                messages: {
                  some: { body: { contains: opts.q, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    };

    const [items, totalItems] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: { ...conversationWithRelations, ...lastMessageOnly },
        orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
        take: opts.limit + 1,
        ...(opts.cursor
          ? { cursor: { id: opts.cursor }, skip: 1 }
          : {}),
      }),
      prisma.conversation.count({ where }),
    ]);

    const hasMore = items.length > opts.limit;
    const page = hasMore ? items.slice(0, opts.limit) : items;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return { items: page, nextCursor, totalItems };
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

  /** Muda a etapa (status) da conversa e marca quando a mudança ocorreu. Sempre escopado ao tenant. */
  async updateStage(tenantId: string, conversationId: string, status: ConversationStatus) {
    const { count } = await prisma.conversation.updateMany({
      where: { id: conversationId, tenantId },
      data: { status, stageChangedAt: new Date() },
    });
    return count > 0;
  },

  /** @deprecated use `updateStage` — mantido só para não quebrar chamadores existentes. */
  async updateStatus(tenantId: string, conversationId: string, status: ConversationStatus) {
    return conversationPrismaRepository.updateStage(tenantId, conversationId, status);
  },

  /**
   * Cria uma mensagem na conversa (inbound ou outbound) e atualiza `lastMessageAt`
   * (e `lastInboundAt` quando inbound) em transação. Retorna `null` se a conversa
   * não pertence ao tenant.
   */
  async createMessage(
    tenantId: string,
    conversationId: string,
    input: {
      direction: MessageDirection;
      body: string;
      status: MessageStatus;
      actorUserId?: string;
    },
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { id: true },
    });
    if (!conversation) return null;

    const now = new Date();
    const [message] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId,
          direction: input.direction,
          body: input.body,
          status: input.status,
          actorUserId: input.actorUserId,
          sentAt: input.status === "sent" ? now : null,
          failedAt: input.status === "failed" ? now : null,
        },
      }),
      prisma.conversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: now,
          ...(input.direction === "inbound" ? { lastInboundAt: now } : {}),
        },
      }),
    ]);
    return message;
  },
};
