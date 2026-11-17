import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

/** Nota visível = pertence a uma conversa dentro do escopo do usuário. */
function visibleNoteWhere(
  tenantId: string,
  id: string,
  visibility: Prisma.ConversationWhereInput,
): Prisma.LeadNoteWhereInput {
  return { id, tenantId, conversation: visibility };
}

export const leadNotePrismaRepository = {
  async listByConversation(tenantId: string, conversationId: string, visibility: Prisma.ConversationWhereInput) {
    return prisma.leadNote.findMany({
      where: { tenantId, conversationId, conversation: visibility },
      include: { author: { select: { name: true } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    });
  },

  async create(
    tenantId: string,
    conversationId: string,
    authorId: string,
    input: { text: string; color: string; pinned: boolean },
    clientId: string | null,
  ) {
    return prisma.leadNote.create({
      data: {
        tenantId,
        conversationId,
        authorId,
        clientId,
        text: input.text,
        color: input.color,
        pinned: input.pinned,
      },
      include: { author: { select: { name: true } } },
    });
  },

  async update(
    tenantId: string,
    id: string,
    input: Partial<{ text: string; color: string; pinned: boolean }>,
    visibility: Prisma.ConversationWhereInput,
  ) {
    const { count } = await prisma.leadNote.updateMany({
      where: visibleNoteWhere(tenantId, id, visibility),
      data: {
        ...input,
        ...(input.text !== undefined ? { editedAt: new Date() } : {}),
      },
    });
    if (count === 0) return null;
    return prisma.leadNote.findFirst({
      where: visibleNoteWhere(tenantId, id, visibility),
      include: { author: { select: { name: true } } },
    });
  },

  async remove(tenantId: string, id: string, visibility: Prisma.ConversationWhereInput) {
    const { count } = await prisma.leadNote.deleteMany({ where: visibleNoteWhere(tenantId, id, visibility) });
    return count > 0;
  },
};
