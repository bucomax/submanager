import type { IPatientPortalOtpRepository } from "@/application/ports/patient-portal-otp-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

export class PatientPortalOtpPrismaRepository implements IPatientPortalOtpRepository {
  async countRecentChallenges(clientId: string, since: Date) {
    return prisma.patientPortalOtpChallenge.count({
      where: { clientId, createdAt: { gte: since } },
    });
  }

  async createChallenge(params: {
    clientId: string;
    tenantId: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    await prisma.patientPortalOtpChallenge.create({
      data: {
        clientId: params.clientId,
        tenantId: params.tenantId,
        codeHash: params.codeHash,
        expiresAt: params.expiresAt,
      },
    });
  }

  async findLatestActiveChallenge(clientId: string, tenantId: string) {
    return prisma.patientPortalOtpChallenge.findFirst({
      where: {
        clientId,
        tenantId,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, codeHash: true, attempts: true },
    });
  }

  /** Reserva atomicamente uma tentativa (antes de comparar). false = limite atingido/consumido. */
  async reserveChallengeAttempt(id: string, maxAttempts: number): Promise<boolean> {
    const { count } = await prisma.patientPortalOtpChallenge.updateMany({
      where: { id, consumedAt: null, attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return count === 1;
  }

  /** Consome atomicamente; false se já consumido por outra requisição. */
  async consumeChallengeIfPending(id: string): Promise<boolean> {
    const { count } = await prisma.patientPortalOtpChallenge.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return count === 1;
  }
}

export const patientPortalOtpPrismaRepository = new PatientPortalOtpPrismaRepository();
