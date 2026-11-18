import { logger } from "@/lib/observability/logger";
import type { z } from "zod";

import type {
  ISelfRegisterNotifier,
  ISelfRegisterTx,
  IPatientSelfRegisterStore,
  SelfRegisterClientFields,
} from "@/application/ports/patient-self-register.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";
import { isSelfRegisterInviteUsable } from "@/domain/auth/self-register-invite";
import { TransactionConflictError } from "@/domain/errors/transaction-conflict";
import { formatClientBirthDateIso } from "@/application/use-cases/client/serialize-client-list";
import {
  PUBLIC_SELF_REGISTER_PRIVACY_VERSION,
  PUBLIC_SELF_REGISTER_TERMS_VERSION,
} from "@/lib/constants/public-registration-consent";
import type { publicPatientSelfRegisterBodySchema } from "@/lib/validators/client";

export type ProcessPatientSelfRegisterBody = z.infer<typeof publicPatientSelfRegisterBodySchema>;

export type PatientSelfRegisterGetPreview =
  | { valid: false }
  | {
      valid: true;
      tenantName: string;
      tenantTaxId: string | null;
      expiresAt: string;
      formPrefill?: Record<string, unknown>;
    };

export type CompletePatientSelfRegisterErrorCode = "INVALID_TOKEN" | "SERIALIZABLE_CONFLICT";

export type CompletePatientSelfRegisterResult =
  | { ok: true; afterCommit: () => Promise<void> }
  | { ok: false; code: CompletePatientSelfRegisterErrorCode };

export type PatientSelfRegisterDeps = {
  store: IPatientSelfRegisterStore;
  notifier: ISelfRegisterNotifier;
  /** Link legado sem slug na URL é válido; link novo precisa bater com o tenant do convite. */
  validateInviteTenantSlug: (request: Request, inviteTenantId: string) => Promise<boolean>;
  hashPassword: (plain: string) => Promise<string>;
};

export async function loadPatientSelfRegisterInvitePreviewWith(
  request: Request,
  token: string,
  deps: Pick<PatientSelfRegisterDeps, "store" | "validateInviteTenantSlug">,
): Promise<PatientSelfRegisterGetPreview> {
  if (!token) {
    return { valid: false };
  }

  const row = await deps.store.findInviteForPreview(token);

  const clientOk = !row?.clientId || (row.client != null && row.client.deletedAt == null);
  const ok =
    row &&
    isSelfRegisterInviteUsable(
      { usedAt: row.usedAt, expiresAt: row.expiresAt, tenantIsActive: row.tenant.isActive },
      new Date(),
    ) &&
    clientOk;

  if (!ok) {
    return { valid: false };
  }

  if (!(await deps.validateInviteTenantSlug(request, row.tenantId))) {
    return { valid: false };
  }

  const formPrefill =
    row.clientId && row.client && row.client.deletedAt == null
      ? {
          name: row.client.name,
          phone: row.client.phone,
          email: row.client.email,
          documentId: row.client.documentId,
          caseDescription: row.client.caseDescription,
          postalCode: row.client.postalCode,
          addressLine: row.client.addressLine,
          addressNumber: row.client.addressNumber,
          addressComp: row.client.addressComp,
          neighborhood: row.client.neighborhood,
          city: row.client.city,
          state: row.client.state,
          isMinor: row.client.isMinor,
          birthDate: formatClientBirthDateIso(row.client.birthDate),
          guardianName: row.client.guardianName,
          guardianDocumentId: row.client.guardianDocumentId,
          guardianPhone: row.client.guardianPhone,
          guardianEmail: row.client.guardianEmail,
          guardianRelationship: row.client.guardianRelationship,
          emergencyContactName: row.client.emergencyContactName,
          emergencyContactPhone: row.client.emergencyContactPhone,
          preferredChannel: row.client.preferredChannel,
        }
      : undefined;

  return {
    valid: true,
    tenantName: row.tenant.name,
    tenantTaxId: row.tenant.taxId,
    expiresAt: row.expiresAt.toISOString(),
    ...(formPrefill ? { formPrefill } : {}),
  };
}

type SelfRegisterAuditInput = {
  tenantId: string;
  clientId: string;
  inviteId: string;
  mode: "create" | "update";
};

/** Auditoria e consentimentos entram na mesma transação do cadastro (sem consentimento sem registro). */
async function recordSelfRegisterAudit(
  tx: ISelfRegisterTx,
  { tenantId, clientId, inviteId, mode }: SelfRegisterAuditInput,
): Promise<void> {
  const base = { tenantId, clientId, patientPathwayId: null, actorUserId: null };
  await tx.audit.record({
    ...base,
    type: AuditEventType.SELF_REGISTER_COMPLETED,
    payload: { inviteId, mode },
  });
  await tx.audit.record({
    ...base,
    type: AuditEventType.PATIENT_PORTAL_PASSWORD_SET,
    payload: { clientId },
  });
  await tx.audit.record({
    ...base,
    type: AuditEventType.PATIENT_CONSENT_GIVEN,
    payload: { consentType: "terms", version: PUBLIC_SELF_REGISTER_TERMS_VERSION },
  });
  await tx.audit.record({
    ...base,
    type: AuditEventType.PATIENT_CONSENT_GIVEN,
    payload: { consentType: "lgpd", version: PUBLIC_SELF_REGISTER_PRIVACY_VERSION },
  });
}

type RegisteredPatient = {
  clientId: string;
  patientName: string;
  clinicName: string;
  tenantSlug: string;
  tenantId: string;
};

/** Cria ou atualiza o `Client` do convite, marca o convite usado e registra auditoria; tudo na mesma tx. */
async function registerPatientInTx(
  tx: ISelfRegisterTx,
  input: {
    request: Request;
    token: string;
    clientFields: SelfRegisterClientFields;
    credentials: { portalPasswordHash: string; portalPasswordChangedAt: Date };
    validateInviteTenantSlug: PatientSelfRegisterDeps["validateInviteTenantSlug"];
  },
): Promise<RegisteredPatient | null> {
  const inv = await tx.findInviteByToken(input.token);
  const now = new Date();
  if (
    !inv ||
    !isSelfRegisterInviteUsable(
      { usedAt: inv.usedAt, expiresAt: inv.expiresAt, tenantIsActive: inv.tenant.isActive },
      now,
    )
  ) {
    return null;
  }
  if (!(await input.validateInviteTenantSlug(input.request, inv.tenantId))) {
    return null;
  }

  let mode: SelfRegisterAuditInput["mode"];
  let client: { id: string; name: string };
  if (inv.clientId) {
    const existing = await tx.findActiveClient(inv.tenantId, inv.clientId);
    if (!existing) return null;
    mode = "update";
    client = await tx.updateClient(existing.id, input.clientFields, input.credentials);
  } else {
    mode = "create";
    client = await tx.createClient(inv.tenantId, input.clientFields, input.credentials);
  }

  await tx.markInviteUsed(inv.id, now);
  await recordSelfRegisterAudit(tx, {
    tenantId: inv.tenantId,
    clientId: client.id,
    inviteId: inv.id,
    mode,
  });

  return {
    clientId: client.id,
    patientName: client.name,
    clinicName: inv.tenant.name,
    tenantSlug: inv.tenant.slug,
    tenantId: inv.tenantId,
  };
}

/**
 * POST público: cria/atualiza `Client`, marca convite usado, auditoria/consentimentos (na transação) e e-mails de boas-vindas (`afterCommit`).
 */
export async function completePatientSelfRegister(
  request: Request,
  data: ProcessPatientSelfRegisterBody,
  deps: PatientSelfRegisterDeps,
): Promise<CompletePatientSelfRegisterResult> {
  const { token, password, ...clientFields } = data;
  const patientEmail = clientFields.email?.trim() ?? "";
  const credentials = {
    portalPasswordHash: await deps.hashPassword(password),
    portalPasswordChangedAt: new Date(),
  };

  let registered: RegisteredPatient | null;
  try {
    registered = await deps.store.runSerializable((tx) =>
      registerPatientInTx(tx, {
        request,
        token,
        clientFields,
        credentials,
        validateInviteTenantSlug: deps.validateInviteTenantSlug,
      }),
    );
  } catch (err) {
    if (err instanceof TransactionConflictError) {
      return { ok: false, code: "SERIALIZABLE_CONFLICT" };
    }
    throw err;
  }

  if (!registered) {
    return { ok: false, code: "INVALID_TOKEN" };
  }
  const { tenantId, clientId, patientName, clinicName, tenantSlug } = registered;

  /** E-mails pós-commit; a rota agenda com `after()` (sobrevive em serverless). */
  const afterCommit = async () => {
    await deps.notifier
      .notifyStaffPatientSelfRegistered({ tenantId, clientId, patientName, clinicName })
      .catch((e) => logger.error("[patient-self-register] notify failed", { err: e }));

    if (patientEmail) {
      await deps.notifier
        .notifyPatientWelcome({ tenantId, patientEmail, patientName, clinicName, tenantSlug })
        .catch((e) => logger.error("[patient-self-register] welcome email failed", { err: e }));
    }
  };

  return { ok: true, afterCommit };
}
