import type { IPatientSelfRegisterInviteRepository } from "@/application/ports/patient-self-register-invite-repository.port";
import { prisma } from "@/infrastructure/database/prisma";
import { hashAuthToken } from "@/lib/auth/auth-token-hash";

export class PatientSelfRegisterInvitePrismaRepository implements IPatientSelfRegisterInviteRepository {
  async createInvite(params: {
    tenantId: string;
    token: string;
    expiresAt: Date;
    createdByUserId: string;
    clientId: string | null;
  }) {
    await prisma.patientSelfRegisterInvite.create({
      data: {
        tenantId: params.tenantId,
        // Só o hash (sha256 hex) é persistido; o token cru existe apenas no link/QR devolvido na criação.
        token: hashAuthToken(params.token),
        expiresAt: params.expiresAt,
        createdByUserId: params.createdByUserId,
        clientId: params.clientId ?? null,
      },
    });
  }
}

export const patientSelfRegisterInvitePrismaRepository = new PatientSelfRegisterInvitePrismaRepository();
