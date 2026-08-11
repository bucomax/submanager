import { prisma } from "@/infrastructure/database/prisma";

export const leadNotePrismaRepository = {
  async listByConversation(tenantId: string, conversationId: string) {
    return prisma.leadNote.findMany({
      where: { tenantId, conversationId },
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
  ) {
    const { count } = await prisma.leadNote.updateMany({
      where: { id, tenantId },
      data: {
        ...input,
        ...(input.text !== undefined ? { editedAt: new Date() } : {}),
      },
    });
    if (count === 0) return null;
    return prisma.leadNote.findFirst({
      where: { id, tenantId },
      include: { author: { select: { name: true } } },
    });
  },

  async remove(tenantId: string, id: string) {
    const { count } = await prisma.leadNote.deleteMany({ where: { id, tenantId } });
    return count > 0;
  },
};
