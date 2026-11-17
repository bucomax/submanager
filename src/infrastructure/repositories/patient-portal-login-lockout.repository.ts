import { prisma } from "@/infrastructure/database/prisma";

/**
 * Bloqueio persistente do login por senha do portal (independe de Redis/instância).
 * Todas as escritas são `updateMany` condicionais — atômicas no Postgres.
 */
export class PatientPortalLoginLockoutPrismaRepository {
  async isLocked(clientId: string, now: Date): Promise<boolean> {
    const count = await prisma.client.count({
      where: { id: clientId, portalLockedUntil: { gt: now } },
    });
    return count > 0;
  }

  /**
   * Registra uma senha errada. Ao atingir `maxFailures` aplica o bloqueio e zera o contador.
   * Retorna true quando ESTA chamada ativou o bloqueio.
   */
  async registerFailedAttempt(
    clientId: string,
    params: { now: Date; maxFailures: number; lockMs: number },
  ): Promise<boolean> {
    const { now, maxFailures, lockMs } = params;
    await prisma.client.updateMany({
      where: {
        id: clientId,
        OR: [{ portalLockedUntil: null }, { portalLockedUntil: { lte: now } }],
      },
      data: { portalFailedLoginCount: { increment: 1 } },
    });
    const { count } = await prisma.client.updateMany({
      where: { id: clientId, portalFailedLoginCount: { gte: maxFailures } },
      data: { portalLockedUntil: new Date(now.getTime() + lockMs), portalFailedLoginCount: 0 },
    });
    return count === 1;
  }

  /** Login bem-sucedido: limpa contador e bloqueio expirado. No-op se já estiver limpo. */
  async resetFailedAttempts(clientId: string): Promise<void> {
    await prisma.client.updateMany({
      where: {
        id: clientId,
        OR: [{ portalFailedLoginCount: { gt: 0 } }, { portalLockedUntil: { not: null } }],
      },
      data: { portalFailedLoginCount: 0, portalLockedUntil: null },
    });
  }
}

export const patientPortalLoginLockoutPrismaRepository =
  new PatientPortalLoginLockoutPrismaRepository();
