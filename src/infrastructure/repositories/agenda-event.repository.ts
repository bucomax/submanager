import type { Prisma } from "@prisma/client";

import { prisma } from "@/infrastructure/database/prisma";

const agendaEventWithRelations = {
  owner: { select: { id: true, name: true } },
  conversation: { select: { id: true, displayName: true } },
} as const;

/** `id` + `tenantId` + escopo de visibilidade do usuário (`{}` = sem restrição). */
function visibleEventWhere(
  tenantId: string,
  id: string,
  visibility: Prisma.AgendaEventWhereInput,
): Prisma.AgendaEventWhereInput {
  return { AND: [{ id, tenantId }, visibility] };
}

export const agendaEventPrismaRepository = {
  async listByRange(tenantId: string, from: Date, to: Date, visibility: Prisma.AgendaEventWhereInput) {
    return prisma.agendaEvent.findMany({
      where: { AND: [{ tenantId, startsAt: { gte: from, lt: to } }, visibility] },
      include: agendaEventWithRelations,
      orderBy: { startsAt: "asc" },
    });
  },

  async findByIdInTenant(tenantId: string, id: string, visibility: Prisma.AgendaEventWhereInput) {
    return prisma.agendaEvent.findFirst({
      where: visibleEventWhere(tenantId, id, visibility),
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
    visibility: Prisma.AgendaEventWhereInput,
  ) {
    const { count } = await prisma.agendaEvent.updateMany({
      where: visibleEventWhere(tenantId, id, visibility),
      data: input,
    });
    if (count === 0) return null;
    return agendaEventPrismaRepository.findByIdInTenant(tenantId, id, visibility);
  },

  async remove(tenantId: string, id: string, visibility: Prisma.AgendaEventWhereInput) {
    const { count } = await prisma.agendaEvent.deleteMany({
      where: visibleEventWhere(tenantId, id, visibility),
    });
    return count > 0;
  },
};
