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
  /** Escopo de visibilidade do usuário (ver `buildConversationVisibilityWhereInput`); `{}` = sem restrição. */
  visibility: Prisma.ConversationWhereInput;
};

/** `id` + `tenantId` + escopo de visibilidade — única forma de localizar uma conversa por id. */
function visibleConversationWhere(
  tenantId: string,
  conversationId: string,
  visibility: Prisma.ConversationWhereInput,
): Prisma.ConversationWhereInput {
  return { AND: [{ id: conversationId, tenantId }, visibility] };
}

export const conversationPrismaRepository = {
  /** Todas as conversas do tenant, com a última mensagem de cada uma para montar o preview do card. */
  async listByTenant(tenantId: string, visibility: Prisma.ConversationWhereInput) {
    return prisma.conversation.findMany({
      where: { AND: [{ tenantId }, visibility] },
      include: { ...conversationWithRelations, ...lastMessageOnly },
      orderBy: { lastMessageAt: "desc" },
    });
  },

  /** Lista paginada (cursor) com filtros de canal/etapa/busca — usada pela tela de Conversas. */
  async listByTenantPaged(tenantId: string, opts: ListConversationsPagedOptions) {
    const filters: Prisma.ConversationWhereInput = {
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
    const where: Prisma.ConversationWhereInput = { AND: [filters, opts.visibility] };

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

  /** Existência da conversa no tenant (sem carregar mensagens). */
  async existsInTenant(
    tenantId: string,
    conversationId: string,
    visibility: Prisma.ConversationWhereInput,
  ): Promise<boolean> {
    const row = await prisma.conversation.findFirst({
      where: visibleConversationWhere(tenantId, conversationId, visibility),
      select: { id: true },
    });
    return row != null;
  },

  /** Conversa do tenant com histórico completo de mensagens, ordenado do mais antigo ao mais recente. */
  async findByIdInTenant(tenantId: string, conversationId: string, visibility: Prisma.ConversationWhereInput) {
    return prisma.conversation.findFirst({
      where: visibleConversationWhere(tenantId, conversationId, visibility),
      include: {
        ...conversationWithRelations,
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
  },

  /** Muda a etapa (status) da conversa e marca quando a mudança ocorreu. Sempre escopado ao tenant. */
  async updateStage(
    tenantId: string,
    conversationId: string,
    status: ConversationStatus,
    visibility: Prisma.ConversationWhereInput,
  ) {
    const { count } = await prisma.conversation.updateMany({
      where: visibleConversationWhere(tenantId, conversationId, visibility),
      data: { status, stageChangedAt: new Date() },
    });
    return count > 0;
  },

  /** Conversa visível ao usuário com campos mínimos (cliente vinculado, canal, destinatário). */
  async findVisibleLink(tenantId: string, conversationId: string, visibility: Prisma.ConversationWhereInput) {
    return prisma.conversation.findFirst({
      where: visibleConversationWhere(tenantId, conversationId, visibility),
      select: { id: true, clientId: true },
    });
  },

  /** Vincula a conversa a um `Client` recém-criado (conversão de lead). Sempre escopado ao tenant. */
  /** Vincula só se a conversa ainda não tem paciente (converts concorrentes: só um vence). */
  async linkClient(tenantId: string, conversationId: string, clientId: string) {
    const { count } = await prisma.conversation.updateMany({
      where: { id: conversationId, tenantId, clientId: null },
      data: { clientId },
    });
    return count > 0;
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
    visibility: Prisma.ConversationWhereInput,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: visibleConversationWhere(tenantId, conversationId, visibility),
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
