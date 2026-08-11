import { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";

export const quickPhrasePrismaRepository = {
  async listByTenant(tenantId: string) {
    return prisma.quickPhrase.findMany({
      where: { tenantId },
      orderBy: { title: "asc" },
    });
  },

  async create(
    tenantId: string,
    createdById: string,
    input: { slug: string; title: string; body: string; attachment?: string | null },
  ) {
    return prisma.quickPhrase.create({
      data: {
        tenantId,
        createdById,
        slug: input.slug,
        title: input.title,
        body: input.body,
        attachment: input.attachment ?? null,
      },
    });
  },

  async update(
    tenantId: string,
    id: string,
    input: Partial<{ slug: string; title: string; body: string; attachment: string | null }>,
  ) {
    const { count } = await prisma.quickPhrase.updateMany({
      where: { id, tenantId },
      data: input,
    });
    if (count === 0) return null;
    return prisma.quickPhrase.findFirst({ where: { id, tenantId } });
  },

  async remove(tenantId: string, id: string) {
    const { count } = await prisma.quickPhrase.deleteMany({ where: { id, tenantId } });
    return count > 0;
  },

  async incrementUsage(tenantId: string, id: string) {
    await prisma.quickPhrase.updateMany({
      where: { id, tenantId },
      data: { usageCount: { increment: 1 } },
    });
  },
};

/** Type guard para o erro de unique constraint do Prisma (slug duplicado no tenant). */
export function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}
