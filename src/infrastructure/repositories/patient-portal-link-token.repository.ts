import type {
  IPatientPortalLinkTokenRepository,
  PatientPortalLinkTokenMagicLinkRow,
} from "@/application/ports/patient-portal-link-token-repository.port";
import { prisma } from "@/infrastructure/database/prisma";

export class PatientPortalLinkTokenPrismaRepository implements IPatientPortalLinkTokenRepository {
  async findByTokenForMagicLinkExchange(token: string): Promise<PatientPortalLinkTokenMagicLinkRow | null> {
    const row = await prisma.patientPortalLinkToken.findUnique({
      where: { token },
      include: {
        client: {
          select: {
            id: true,
            tenantId: true,
            deletedAt: true,
            portalPasswordChangedAt: true,
          },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      clientId: row.clientId,
      expiresAt: row.expiresAt,
      singleUse: row.singleUse,
      usedAt: row.usedAt,
      client: row.client,
    };
  }

  /** Marca uso de forma atômica; false se outro request já consumiu o token. */
  async consumeSingleUseIfUnused(id: string, usedAt: Date): Promise<boolean> {
    const { count } = await prisma.patientPortalLinkToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt },
    });
    return count === 1;
  }

  async createPortalLinkToken(params: {
    clientId: string;
    token: string;
    expiresAt: Date;
    singleUse: boolean;
  }) {
    const row = await prisma.patientPortalLinkToken.create({
      data: {
        clientId: params.clientId,
        token: params.token,
        expiresAt: params.expiresAt,
        singleUse: params.singleUse,
      },
      select: { id: true },
    });
    return row;
  }
}

export const patientPortalLinkTokenPrismaRepository = new PatientPortalLinkTokenPrismaRepository();
