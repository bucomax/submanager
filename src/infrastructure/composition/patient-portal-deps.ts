import { logger } from "@/lib/observability/logger";
import type { IPortalOtpDelivery } from "@/application/ports/patient-portal-otp-delivery.port";
import { getPatientPortalOtpHtml } from "@/infrastructure/email/email-templates";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { resolveTenantSender } from "@/infrastructure/email/resolve-tenant-sender";
import { notifyPatientPortalOtpByWebhook } from "@/infrastructure/notifications/patient-portal-otp-wpp";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { patientPortalLoginLockoutPrismaRepository } from "@/infrastructure/repositories/patient-portal-login-lockout.repository";
import { patientPortalOtpPrismaRepository } from "@/infrastructure/repositories/patient-portal-otp.repository";

const portalOtpDelivery: IPortalOtpDelivery = {
  canSendEmail: canSendEmailForTenant,

  isWhatsAppWebhookConfigured: () => Boolean(process.env.PATIENT_PORTAL_OTP_NOTIFY_URL?.trim()),

  async sendEmailCode({ tenantId, recipients, patientName, clinicName, code }) {
    const { from, useSmtp } = await resolveTenantSender(tenantId);
    const subject = `${clinicName}: seu código do portal do paciente`;
    const html = getPatientPortalOtpHtml({ patientName, clinicName, code });
    const text = `Olá, ${patientName}. Seu código SubManager: ${code}. Válido por poucos minutos.`;
    for (const to of recipients) {
      const { error } = await sendEmail({ to, from, subject, html, text, tenantId, useSmtp });
      if (error) {
        logger.error("[patient-portal] OTP email failed", { err: error });
      }
    }
  },

  async sendWhatsAppCode({ phones, clinicName, code }) {
    const text = `SubManager (${clinicName}): seu código para acessar o portal é ${code}. Válido por poucos minutos.`;
    for (const phone of phones) {
      await notifyPatientPortalOtpByWebhook({ phone, text });
    }
  },
};

/** Dependências de produção dos três casos de uso do portal (cada um usa o subconjunto de que precisa). */
export const defaultPatientPortalDeps = {
  otp: patientPortalOtpPrismaRepository,
  delivery: portalOtpDelivery,
  clients: clientPrismaRepository,
  lockout: patientPortalLoginLockoutPrismaRepository,
};
