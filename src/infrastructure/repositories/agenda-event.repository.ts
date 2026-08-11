import { prisma } from "@/infrastructure/database/prisma";

const agendaEventWithRelations = {
  owner: { select: { id: true, name: true } },
  conversation: { select: { id: true, displayName: true } },
} as const;

export const agendaEventPrismaRepository = {
  async listByRange(tenantId: string, from: Date, to: Date) {
    return prisma.agendaEvent.findMany({
      where: { tenantId, startsAt: { gte: from, lt: to } },
      include: agendaEventWithRelations,
      orderBy: { startsAt: "asc" },
    });
  },

  async findByIdInTenant(tenantId: string, id: string) {
    return prisma.agendaEvent.findFirst({
      where: { id, tenantId },
      include: agendaEventWithRelations,
    });
  },

  async create(
    tenantId: string,
    input: {
      conversationId?: string | null;
      clientId?: string | null;
      title: string;
      type: string;
      startsAt: Date;
      durationMin: number;
      ownerUserId: string;
      notes?: string | null;
    },
  ) {
    return prisma.agendaEvent.create({
      data: {
        tenantId,
        conversationId: input.conversationId ?? null,
        clientId: input.clientId ?? null,
        title: input.title,
        type: input.type,
        startsAt: input.startsAt,
        durationMin: input.durationMin,
        ownerUserId: input.ownerUserId,
        notes: input.notes ?? null,
      },
      include: agendaEventWithRelations,
    });
  },

  async update(
    tenantId: string,
    id: string,
    input: Partial<{
      conversationId: string | null;
      clientId: string | null;
      title: string;
      type: string;
      startsAt: Date;
      durationMin: number;
      ownerUserId: string;
      notes: string | null;
    }>,
  ) {
    const { count } = await prisma.agendaEvent.updateMany({
      where: { id, tenantId },
      data: input,
    });
    if (count === 0) return null;
    return agendaEventPrismaRepository.findByIdInTenant(tenantId, id);
  },

  async remove(tenantId: string, id: string) {
    const { count } = await prisma.agendaEvent.deleteMany({ where: { id, tenantId } });
    return count > 0;
  },
};
