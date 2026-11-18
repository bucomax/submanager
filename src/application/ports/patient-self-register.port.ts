import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { publicPatientSelfRegisterBodySchema } from "@/lib/validators/client";
import type { z } from "zod";

type SelfRegisterBody = z.infer<typeof publicPatientSelfRegisterBodySchema>;

/** Campos do paciente informados no formulário público (sem token/senha). */
export type SelfRegisterClientFields = Omit<SelfRegisterBody, "token" | "password">;

export type PortalPasswordCredentials = {
  portalPasswordHash: string;
  portalPasswordChangedAt: Date;
};

export type SelfRegisterInviteRow = {
  id: string;
  tenantId: string;
  clientId: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  tenant: { id: string; name: string; slug: string; isActive: boolean };
};

export type SelfRegisterInvitePreviewRow = {
  tenantId: string;
  clientId: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  tenant: { name: string; taxId: string | null; isActive: boolean };
  client: {
    name: string;
    phone: string;
    email: string | null;
    documentId: string | null;
    caseDescription: string | null;
    postalCode: string | null;
    addressLine: string | null;
    addressNumber: string | null;
    addressComp: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    isMinor: boolean;
    birthDate: Date | null;
    guardianName: string | null;
    guardianDocumentId: string | null;
    guardianPhone: string | null;
    guardianEmail: string | null;
    guardianRelationship: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    preferredChannel: string | null;
    deletedAt: Date | null;
  } | null;
};

export interface ISelfRegisterTx {
  readonly audit: IAuditRecorder;
  findInviteByToken(token: string): Promise<SelfRegisterInviteRow | null>;
  /** Cliente ativo (não removido) do tenant. */
  findActiveClient(tenantId: string, clientId: string): Promise<{ id: string } | null>;
  updateClient(
    clientId: string,
    fields: SelfRegisterClientFields,
    credentials: PortalPasswordCredentials,
  ): Promise<{ id: string; name: string }>;
  createClient(
    tenantId: string,
    fields: SelfRegisterClientFields,
    credentials: PortalPasswordCredentials,
  ): Promise<{ id: string; name: string }>;
  markInviteUsed(inviteId: string, usedAt: Date): Promise<void>;
}

export interface IPatientSelfRegisterStore {
  /**
   * Unit of work com isolamento serializável.
   * Conflito de serialização é lançado como `TransactionConflictError`.
   */
  runSerializable<T>(fn: (tx: ISelfRegisterTx) => Promise<T>): Promise<T>;
  findInviteForPreview(token: string): Promise<SelfRegisterInvitePreviewRow | null>;
}

export interface ISelfRegisterNotifier {
  notifyStaffPatientSelfRegistered(input: {
    tenantId: string;
    clientId: string;
    patientName: string;
    clinicName: string;
  }): Promise<void>;
  notifyPatientWelcome(input: {
    tenantId: string;
    patientEmail: string;
    patientName: string;
    clinicName: string;
    tenantSlug: string;
  }): Promise<void>;
}
