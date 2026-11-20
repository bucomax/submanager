import { logger } from "@/lib/observability/logger";
import type { IPatientPortalOtpRepository } from "@/application/ports/patient-portal-otp-repository.port";
import type { IPortalOtpDelivery } from "@/application/ports/patient-portal-otp-delivery.port";
import { resolvePortalOtpDelivery } from "@/domain/auth/patient-portal-otp-channels";
import {
  PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW,
  PATIENT_PORTAL_OTP_REQUEST_WINDOW_MS,
  PATIENT_PORTAL_OTP_TTL_MS,
} from "@/lib/constants/patient-portal";
import {
  generatePatientPortalOtpCode,
  hashPatientPortalOtpCode,
} from "@/lib/utils/patient-portal-otp";
import type { PortalClientForLogin } from "@/types/api/patient-portal-v1";

export type RequestPatientPortalOtpResult =
  | { kind: "opaque" }
  | { kind: "rate_limited" }
  | { kind: "service_unavailable" }
  /**
   * Desafio criado. `deliver` envia o código (e-mail/WhatsApp); a rota agenda com `after()` para a resposta não
   * demorar mais para CPF existente do que para inexistente (oráculo por tempo). Nunca rejeita: falha só é logada.
   */
  | { kind: "sent"; deliver: () => Promise<void> };

export type RequestPatientPortalOtpDeps = {
  otp: Pick<IPatientPortalOtpRepository, "countRecentChallenges" | "createChallenge">;
  delivery: IPortalOtpDelivery;
};

/**
 * Cria desafio OTP e envia por e-mail e/ou webhook WhatsApp quando há canal configurado.
 * Respostas opacas quando o cliente não existe ou não há canal — anti-enumeração.
 */
export async function requestPatientPortalOtp(
  params: { tenant: { id: string; name: string }; client: PortalClientForLogin | null },
  deps: RequestPatientPortalOtpDeps,
): Promise<RequestPatientPortalOtpResult> {
  const { tenant, client } = params;
  if (!client) {
    return { kind: "opaque" };
  }

  const windowStart = new Date(Date.now() - PATIENT_PORTAL_OTP_REQUEST_WINDOW_MS);
  const recentCount = await deps.otp.countRecentChallenges(client.id, windowStart);
  if (recentCount >= PATIENT_PORTAL_OTP_MAX_REQUESTS_PER_WINDOW) {
    return { kind: "rate_limited" };
  }

  const delivery = resolvePortalOtpDelivery(client, {
    canEmail: await deps.delivery.canSendEmail(tenant.id),
    hasWebhook: deps.delivery.isWhatsAppWebhookConfigured(),
  });
  if (!delivery.emailReady && !delivery.wppReady) {
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

  await deps.otp.createChallenge({
    clientId: client.id,
    tenantId: tenant.id,
    codeHash,
    expiresAt: new Date(Date.now() + PATIENT_PORTAL_OTP_TTL_MS),
  });

  const deliver = async (): Promise<void> => {
    const sends: Promise<void>[] = [];
    if (delivery.emailReady) {
      sends.push(
        deps.delivery.sendEmailCode({
          tenantId: tenant.id,
          recipients: delivery.emailRecipients,
          patientName: client.name,
          clinicName: tenant.name,
          code,
        }),
      );
    }
    if (delivery.wppReady) {
      sends.push(
        deps.delivery.sendWhatsAppCode({
          phones: delivery.phoneRecipients,
          clinicName: tenant.name,
          code,
        }),
      );
    }
    // Um canal falhar não impede o outro; falha só é logada (sem código nem contato).
    for (const outcome of await Promise.allSettled(sends)) {
      if (outcome.status === "rejected") {
        logger.error("[patient-portal] OTP delivery failed", {
          tenantId: tenant.id,
          clientId: client.id,
          err: outcome.reason,
        });
      }
    }
  };

  return { kind: "sent", deliver };
}
