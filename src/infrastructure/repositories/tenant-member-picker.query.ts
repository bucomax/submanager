import type { Prisma, PrismaClient } from "@prisma/client";

/** Primeiro candidato (na ordem dada) com membership no tenant; ignora IDs de fora. */
export async function pickFirstTenantMemberFrom(
  db: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  candidateUserIds: string[],
): Promise<string | null> {
  if (candidateUserIds.length === 0) return null;
  const rows = await db.tenantMembership.findMany({
    where: { tenantId, userId: { in: candidateUserIds } },
    select: { userId: true },
  });
  const members = new Set(rows.map((r) => r.userId));
  return candidateUserIds.find((id) => members.has(id)) ?? null;
}
