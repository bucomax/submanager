import { PATIENT_PORTAL_SESSION_MAX_AGE_SEC } from "@/lib/constants/patient-portal";
import {
  portalPasswordVersionMs,
  type PatientPortalSessionPayload,
} from "@/lib/auth/patient-portal-session";
import { patientPortalLinkTokenPrismaRepository } from "@/infrastructure/repositories/patient-portal-link-token.repository";

export type ExchangePatientPortalMagicLinkResult =
  | { ok: true; sessionPayload: PatientPortalSessionPayload }
  | { ok: false };

export async function runExchangePatientPortalMagicLink(params: {
  tenant: { id: string; slug: string };
  token: string;
}): Promise<ExchangePatientPortalMagicLinkResult> {
  const { tenant, token } = params;

  const row = await patientPortalLinkTokenPrismaRepository.findByTokenForMagicLinkExchange(token);

  const now = new Date();
  if (
    !row ||
    row.expiresAt < now ||
    row.client.deletedAt != null ||
    row.client.tenantId !== tenant.id
  ) {
    return { ok: false };
  }

  if (row.singleUse && row.usedAt != null) {
    return { ok: false };
  }

  if (row.singleUse) {
    const consumed = await patientPortalLinkTokenPrismaRepository.consumeSingleUseIfUnused(row.id, now);
    if (!consumed) return { ok: false };
  }

  const exp = Math.floor(Date.now() / 1000) + PATIENT_PORTAL_SESSION_MAX_AGE_SEC;
  const sessionPayload: PatientPortalSessionPayload = {
    clientId: row.clientId,
    tenantId: row.client.tenantId,
    tenantSlug: tenant.slug,
    exp,
    pwdv: portalPasswordVersionMs(row.client.portalPasswordChangedAt),
  };

  return { ok: true, sessionPayload };
}
