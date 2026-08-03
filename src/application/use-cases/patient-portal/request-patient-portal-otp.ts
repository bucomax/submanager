import {
  PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW,
  PATIENT_PORTAL_OTP_REQUEST_WINDOW_MS,
  PATIENT_PORTAL_OTP_TTL_MS,
} from "@/lib/constants/patient-portal";
import { getPatientPortalOtpHtml } from "@/infrastructure/email/email-templates";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { notifyPatientPortalOtpByWebhook } from "@/infrastructure/notifications/patient-portal-otp-wpp";
import { patientPortalOtpPrismaRepository } from "@/infrastructure/repositories/patient-portal-otp.repository";
import { digitsOnlyPhone } from "@/lib/validators/phone";
import {
  generatePatientPortalOtpCode,
  hashPatientPortalOtpCode,
} from "@/lib/utils/patient-portal-otp";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type RequestPatientPortalOtpResult =
  | { kind: "opaque" }
  | { kind: "rate_limited" }
  | { kind: "service_unavailable" }
  | { kind: "sent" };

/**
 * Cria desafio OTP e envia por e-mail e/ou webhook WhatsApp quando há canal configurado.
 * Respostas opacas quando o cliente não existe ou não há canal — anti-enumeração.
 */
export async function runRequestPatientPortalOtp(params: {
  tenant: { id: string; name: string };
  client: PortalClientForLogin | null;
}): Promise<RequestPatientPortalOtpResult> {
  const { tenant, client } = params;
  if (!client) {
    return { kind: "opaque" };
  }

  const windowStart = new Date(Date.now() - PATIENT_PORTAL_OTP_REQUEST_WINDOW_MS);
  const recentCount = await patientPortalOtpPrismaRepository.countRecentChallenges(
    client.id,
    windowStart,
  );
  if (recentCount >= PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW) {
    return { kind: "rate_limited" };
  }

  const email = client.email?.trim() ?? "";
  const guardianEmail = client.isMinor ? (client.guardianEmail?.trim() ?? "") : "";
  const hasWebhook = Boolean(process.env.PATIENT_PORTAL_OTP_NOTIFY_URL?.trim());
  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";
  const guardianPhoneDigits = client.isMinor ? digitsOnlyPhone(client.guardianPhone ?? "") : "";
  const canEmail = await canSendEmailForTenant(tenant.id);
  const emailReady =
    canEmail &&
    (Boolean(email) ||
      (client.isMinor &&
        Boolean(guardianEmail) &&
        guardianEmail.toLowerCase() !== email.toLowerCase()));
  const wppReady =
    hasWebhook && (phoneDigits.length >= 10 || (client.isMinor && guardianPhoneDigits.length >= 10));

  if (!emailReady && !wppReady) {
    return { kind: "opaque" };
  }

  let code: string;
  let codeHash: string;
  try {
    code = generatePatientPortalOtpCode();
    codeHash = hashPatientPortalOtpCode(code);
  } catch {
    return { kind: "service_unavailable" };
  }

  const expiresAt = new Date(Date.now() + PATIENT_PORTAL_OTP_TTL_MS);

  await patientPortalOtpPrismaRepository.createChallenge({
    clientId: client.id,
    tenantId: tenant.id,
    codeHash,
    expiresAt,
  });

  const clinicName = tenant.name;

  if (emailReady) {
    const { from, useSmtp } = await resolveTenantSender(tenant.id);
    const subject = `${clinicName} — Código do portal do paciente (SubManager)`;
    const html = getPatientPortalOtpHtml({
      patientName: client.name,
      clinicName,
      code,
    });
    const text = `Olá, ${client.name}. Seu código SubManager: ${code}. Válido por poucos minutos.`;
    const toList: string[] = [];
    if (email) toList.push(email);
    if (
      client.isMinor &&
      guardianEmail &&
      guardianEmail.toLowerCase() !== email.toLowerCase() &&
      !toList.some((x) => x.toLowerCase() === guardianEmail.toLowerCase())
    ) {
      toList.push(guardianEmail);
    }
    for (const to of toList) {
      const { error } = await sendEmail({
        to,
        from,
        subject,
        html,
        text,
        tenantId: tenant.id,
        useSmtp,
      });
      if (error) {
        console.error("[patient-portal] OTP email failed:", error);
      }
    }
  }

  if (wppReady) {
    const text = `SubManager (${clinicName}): seu código para acessar o portal é ${code}. Válido por poucos minutos.`;
    const phones: string[] = [];
    if (phoneDigits.length >= 10) phones.push(client.phone!.trim());
    if (
      client.isMinor &&
      guardianPhoneDigits.length >= 10 &&
      guardianPhoneDigits !== phoneDigits
    ) {
      phones.push(client.guardianPhone!.trim());
    }
    for (const phone of phones) {
      await notifyPatientPortalOtpByWebhook({ phone, text });
    }
  }

  return { kind: "sent" };
}
