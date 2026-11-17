import { AuditEventType, type Prisma } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import {
  isResendApiConfigured,
  resendCreateDomain,
  resendDeleteDomain,
  resendGetDomain,
  resendVerifyDomain,
} from "@/infrastructure/email/resend-domain.client";
import type {
  EmailDomainDnsRow,
  TenantEmailDomainDto,
} from "@/types/api/email-domain-v1";
import type { PatchTenantEmailDomainBody, PostSetupTenantEmailDomainBody } from "@/lib/validators/email-domain";

function toPublicStatus(
  row: NonNullable<Awaited<ReturnType<typeof tenantPrismaRepository.findTenantEmailDomainInternal>>>,
): TenantEmailDomainDto["status"] {
  if (!row.emailResendDomainId && !row.emailDomainName) {
    return "none";
  }
  const s = (row.emailDomainStatus ?? "").toLowerCase();
  if (s === "verified") return "verified";
  if (s === "failed" || s === "temporary_failure") {
    return s === "temporary_failure" ? "temporary_failure" : "failed";
  }
  if (s === "not_started" || s === "pending" || s === "dns_pending") {
    return "pending";
  }
  return "pending";
}

function dnsJsonToRows(json: unknown): EmailDomainDnsRow[] | null {
  if (json == null) return null;
  if (Array.isArray(json)) {
    return json as EmailDomainDnsRow[];
  }
  return null;
}

export function tenantToEmailDomainDto(
  row: NonNullable<Awaited<ReturnType<typeof tenantPrismaRepository.findTenantEmailDomainInternal>>>,
): TenantEmailDomainDto {
  return {
    outboundMode: row.emailOutboundMode,
    emailEnabled: row.emailEnabled,
    fromName: row.emailFromName,
    fromAddress: row.emailFromAddress,
    domainName: row.emailDomainName,
    status: toPublicStatus(row),
    dnsRecords: dnsJsonToRows(row.emailDomainDnsRecords) ?? (row.emailResendDomainId ? [] : null),
    verifiedAt: row.emailDomainVerifiedAt?.toISOString() ?? null,
  };
}

export async function getTenantEmailDomainState(tenantId: string) {
  const row = await tenantPrismaRepository.findTenantEmailDomainInternal(tenantId);
  if (!row) return null;
  return tenantToEmailDomainDto(row);
}

export type SetupEmailDomainResult =
  | { ok: true; dto: TenantEmailDomainDto }
  | { ok: false; code: "TENANT_NOT_FOUND" | "RESEND_NOT_CONFIGURED" | "ALREADY_HAS_DOMAIN" | "RESEND_ERROR" | "RESEND_DUPLICATE"; errorMessage?: string };

export async function setupTenantEmailDomain(
  params: { tenantId: string; body: PostSetupTenantEmailDomainBody; actorUserId: string },
): Promise<SetupEmailDomainResult> {
  const { tenantId, body, actorUserId } = params;
  if (!isResendApiConfigured()) {
    return { ok: false, code: "RESEND_NOT_CONFIGURED" };
  }
  const existing = await tenantPrismaRepository.findTenantEmailDomainInternal(tenantId);
  if (!existing) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  if (existing.emailResendDomainId) {
    return { ok: false, code: "ALREADY_HAS_DOMAIN" };
  }

  const domainName = body.domainName;
  const fromAddress = `${body.localPart}@${domainName}`.toLowerCase();

  const created = await resendCreateDomain(domainName);
  if (!created.ok) {
    const msg = created.error;
    if (/already|duplicat|exist/i.test(msg)) {
      return { ok: false, code: "RESEND_DUPLICATE", errorMessage: msg };
    }
    return { ok: false, code: "RESEND_ERROR", errorMessage: msg };
  }

  const d = created.domain;
  const recordsJson = (d.records ?? []) as unknown as Prisma.InputJsonValue;

  await tenantPrismaRepository.updateTenantEmailDomainAfterSetup(tenantId, {
    emailResendDomainId: d.id,
    emailDomainName: d.name,
    emailDomainStatus: d.status,
    emailDomainDnsRecords: recordsJson,
    emailFromName: body.fromName,
    emailFromAddress: fromAddress,
    emailEnabled: false,
    emailOutboundMode: "resend_domain",
  });

  await auditEventPrismaRepository.recordCanonical({
    tenantId,
    clientId: null,
    patientPathwayId: null,
    actorUserId,
    eventType: AuditEventType.TENANT_EMAIL_DOMAIN_CONFIGURED,
    payload: { domainName: d.name, resendIdPresent: true },
  });

  const after = await tenantPrismaRepository.findTenantEmailDomainInternal(tenantId);
  return { ok: true, dto: tenantToEmailDomainDto(after!) };
}

export type VerifyEmailDomainResult =
  | { ok: true; dto: TenantEmailDomainDto }
  | { ok: false; code: "TENANT_NOT_FOUND" | "NO_DOMAIN" | "RESEND_NOT_CONFIGURED" | "RESEND_ERROR"; errorMessage?: string };

export async function verifyTenantEmailDomain(params: {
  tenantId: string;
}): Promise<VerifyEmailDomainResult> {
  if (!isResendApiConfigured()) {
    return { ok: false, code: "RESEND_NOT_CONFIGURED" };
  }
  const row = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  if (!row) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  const resendId = row.emailResendDomainId;
  if (!resendId) {
    return { ok: false, code: "NO_DOMAIN" };
  }

  const v = await resendVerifyDomain(resendId);
  if (!v.ok) {
    return { ok: false, code: "RESEND_ERROR", errorMessage: v.error };
  }
  const refreshed = await resendGetDomain(resendId);
  const d = refreshed.ok ? refreshed.domain : v.domain;
  const verified = d.status === "verified";
  const records = (d.records ?? []) as unknown as Prisma.InputJsonValue;

  await tenantPrismaRepository.updateTenantEmailDomainFromVerify(params.tenantId, {
    emailDomainStatus: d.status,
    emailDomainDnsRecords: records,
    emailDomainVerifiedAt: verified ? new Date() : row.emailDomainVerifiedAt,
  });

  const after = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  return { ok: true, dto: tenantToEmailDomainDto(after!) };
}

export type RemoveEmailDomainResult =
  | { ok: true; dto: TenantEmailDomainDto }
  | { ok: false; code: "TENANT_NOT_FOUND" | "RESEND_ERROR" | "RESEND_NOT_CONFIGURED" };

export async function removeTenantEmailDomain(params: {
  tenantId: string;
  actorUserId: string;
}): Promise<RemoveEmailDomainResult> {
  const row = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  if (!row) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  if (row.emailResendDomainId && isResendApiConfigured()) {
    const del = await resendDeleteDomain(row.emailResendDomainId);
    if (!del.ok) {
      return { ok: false, code: "RESEND_ERROR" };
    }
  }

  await tenantPrismaRepository.clearTenantEmailDomain(params.tenantId);

  await auditEventPrismaRepository.recordCanonical({
    tenantId: params.tenantId,
    clientId: null,
    patientPathwayId: null,
    actorUserId: params.actorUserId,
    eventType: AuditEventType.TENANT_EMAIL_DOMAIN_REMOVED,
    payload: { hadDomain: Boolean(row.emailResendDomainId) },
  });

  const after = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  return { ok: true, dto: tenantToEmailDomainDto(after!) };
}

export type PatchEmailDomainResult =
  | { ok: true; dto: TenantEmailDomainDto }
  | { ok: false; code: "TENANT_NOT_FOUND" | "VALIDATION" | "DOMAIN_NOT_VERIFIED" };

export async function patchTenantEmailDomainInput(params: {
  tenantId: string;
  body: PatchTenantEmailDomainBody;
}): Promise<PatchEmailDomainResult> {
  const row = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  if (!row) {
    return { ok: false, code: "TENANT_NOT_FOUND" };
  }
  const { body } = params;

  if (body.emailEnabled === true) {
    if ((row.emailDomainStatus ?? "").toLowerCase() !== "verified" || !row.emailFromAddress?.trim()) {
      return { ok: false, code: "DOMAIN_NOT_VERIFIED" };
    }
  }

  if (body.fromAddress !== undefined && row.emailDomainName) {
    const host = body.fromAddress.split("@")[1]?.toLowerCase();
    if (host && host !== row.emailDomainName.toLowerCase()) {
      return { ok: false, code: "VALIDATION" };
    }
  }

  await tenantPrismaRepository.patchTenantEmailDomainSettings(params.tenantId, {
    ...(body.emailOutboundMode !== undefined ? { emailOutboundMode: body.emailOutboundMode } : {}),
    ...(body.emailOutboundMode === "smtp" ? { smtpEnabled: true } : {}),
    ...(body.emailOutboundMode === "platform" || body.emailOutboundMode === "resend_domain"
      ? { smtpEnabled: false }
      : {}),
    ...(body.emailEnabled !== undefined ? { emailEnabled: body.emailEnabled } : {}),
    ...(body.fromName !== undefined ? { emailFromName: body.fromName } : {}),
    ...(body.fromAddress !== undefined ? { emailFromAddress: body.fromAddress } : {}),
  });

  const after = await tenantPrismaRepository.findTenantEmailDomainInternal(params.tenantId);
  return { ok: true, dto: tenantToEmailDomainDto(after!) };
}
