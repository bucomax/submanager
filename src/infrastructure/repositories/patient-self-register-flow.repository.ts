import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import type {
  IPatientSelfRegisterStore,
  ISelfRegisterTx,
  PortalPasswordCredentials,
  SelfRegisterClientFields,
} from "@/application/ports/patient-self-register.port";
import { TransactionConflictError } from "@/domain/errors/transaction-conflict";
import { prisma } from "@/infrastructure/database/prisma";
import { createPrismaAuditRecorder } from "@/infrastructure/repositories/audit-recorder.repository";
import { hashAuthToken } from "@/lib/auth/auth-token-hash";

const PRISMA_SERIALIZATION_FAILURE = "P2034";

/**
 * O token é guardado como sha256 hex. TODO(remover na release seguinte ao deploy): aceita também o valor cru,
 * para convites emitidos entre a migration de hash e o deploy do código novo (TTL de 48h).
 */
function inviteTokenCandidates(rawToken: string): string[] {
  return [hashAuthToken(rawToken), rawToken];
}

/** Colunas do `Client` preenchidas pelo formulário público (explícito: nada além do contrato vaza para o DB). */
function toClientColumns(cf: SelfRegisterClientFields, credentials: PortalPasswordCredentials) {
  return {
    name: cf.name,
    phone: cf.phone,
    email: cf.email,
    caseDescription: cf.caseDescription,
    documentId: cf.documentId,
    postalCode: cf.postalCode,
    addressLine: cf.addressLine,
    addressNumber: cf.addressNumber,
    addressComp: cf.addressComp,
    neighborhood: cf.neighborhood,
    city: cf.city,
    state: cf.state,
    isMinor: cf.isMinor,
    birthDate: cf.birthDate,
    guardianName: cf.guardianName,
    guardianDocumentId: cf.guardianDocumentId,
    guardianPhone: cf.guardianPhone,
    guardianEmail: cf.guardianEmail,
    guardianRelationship: cf.guardianRelationship,
    emergencyContactName: cf.emergencyContactName,
    emergencyContactPhone: cf.emergencyContactPhone,
    preferredChannel: cf.preferredChannel,
    portalPasswordHash: credentials.portalPasswordHash,
    portalPasswordChangedAt: credentials.portalPasswordChangedAt,
  };
}

function createTx(tx: Prisma.TransactionClient): ISelfRegisterTx {
  return {
    audit: createPrismaAuditRecorder(tx),

    findInviteByToken: (token) =>
      tx.patientSelfRegisterInvite.findFirst({
        where: { token: { in: inviteTokenCandidates(token) } },
        include: { tenant: { select: { id: true, name: true, slug: true, isActive: true } } },
      }),

    findActiveClient: (tenantId, clientId) =>
      tx.client.findFirst({
        where: { id: clientId, tenantId, deletedAt: null },
        select: { id: true },
      }),

    updateClient: (clientId, fields, credentials) =>
      tx.client.update({
        where: { id: clientId },
        data: toClientColumns(fields, credentials),
        select: { id: true, name: true },
      }),

    createClient: (tenantId, fields, credentials) =>
      tx.client.create({
        data: { tenantId, ...toClientColumns(fields, credentials) },
        select: { id: true, name: true },
      }),

    async markInviteUsed(inviteId, usedAt) {
      await tx.patientSelfRegisterInvite.update({ where: { id: inviteId }, data: { usedAt } });
    },
  };
}

export const patientSelfRegisterPrismaStore: IPatientSelfRegisterStore = {
  async runSerializable(fn) {
    try {
      return await prisma.$transaction((tx) => fn(createTx(tx)), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === PRISMA_SERIALIZATION_FAILURE) {
        throw new TransactionConflictError("Serializable transaction conflict", { cause: err });
      }
      throw err;
    }
  },

  findInviteForPreview: (token) =>
    prisma.patientSelfRegisterInvite.findFirst({
      where: { token: { in: inviteTokenCandidates(token) } },
      include: {
        tenant: { select: { name: true, taxId: true, isActive: true } },
        client: {
          select: {
            name: true,
            phone: true,
            email: true,
            documentId: true,
            caseDescription: true,
            postalCode: true,
            addressLine: true,
            addressNumber: true,
            addressComp: true,
            neighborhood: true,
            city: true,
            state: true,
            isMinor: true,
            birthDate: true,
            guardianName: true,
            guardianDocumentId: true,
            guardianPhone: true,
            guardianEmail: true,
            guardianRelationship: true,
            emergencyContactName: true,
            emergencyContactPhone: true,
            preferredChannel: true,
            deletedAt: true,
          },
        },
      },
    }),
};
