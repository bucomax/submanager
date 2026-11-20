import { logger } from "@/lib/observability/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { sendEmailViaSmtp } from "@/infrastructure/email/smtp-send.client";
import { isResendApiConfigured } from "@/infrastructure/email/resend-domain.client";
import { classifyResendError, EmailSendError, withTimeout } from "@/infrastructure/email/email-send-error";
import { Resend } from "resend";

const defaultFromEmail = process.env.EMAIL_FROM ?? "SubManager <onboarding@resend.dev>";
const resendApiKey = process.env.RESEND_API_KEY;

/** Timeout do envio via API Resend (SMTP tem o próprio, 10s). */
const RESEND_SEND_TIMEOUT_MS = 15_000;

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY não configurada.");
  }
  if (!resendClient) {
    resendClient = new Resend(resendApiKey);
  }
  return resendClient;
}

/**
 * Envia e-mail: SMTP do tenant se `useSmtp` e credenciais ok; senão Resend.
 * `error` é um `EmailSendError` quando a falha foi classificada (ver `isRetryableEmailError`).
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  /** Quando o tenant usa SMTP, deve ser true. */
  useSmtp?: boolean;
  tenantId?: string;
  /** Só Resend: reenvio com a mesma chave (retry após timeout) não duplica o e-mail. */
  idempotencyKey?: string;
}): Promise<{ id?: string; error?: Error }> {
  if (params.useSmtp && params.tenantId) {
    return sendViaTenantSmtp({
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      from: params.from,
      tenantId: params.tenantId,
    });
  }
  if (!isResendApiConfigured()) {
    return { error: new Error("Nenhum transporte de e-mail disponível (Resend).") };
  }
  return sendViaResend({
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    from: params.from ?? defaultFromEmail,
    idempotencyKey: params.idempotencyKey,
  });
}

async function sendViaTenantSmtp(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  tenantId: string;
}): Promise<{ id?: string; error?: Error }> {
  const t = await prisma.tenant.findUnique({
    where: { id: params.tenantId },
    select: {
      emailOutboundMode: true,
      smtpHost: true,
      smtpPort: true,
      smtpSecure: true,
      smtpUser: true,
      smtpPasswordEnc: true,
    },
  });
  if (
    t?.emailOutboundMode !== "smtp" ||
    !t.smtpHost?.trim() ||
    !t.smtpUser?.trim() ||
    !t.smtpPasswordEnc
  ) {
    if (isResendApiConfigured()) {
      return sendViaResend({ ...params, from: params.from ?? defaultFromEmail });
    }
    return { error: new Error("SMTP não configurado para este ambiente de envio.") };
  }
  let pass: string;
  try {
    pass = decryptTenantSecret(t.smtpPasswordEnc);
  } catch (e) {
    logger.error("SMTP password decrypt failed", { err: e });
    return { error: new Error("Falha ao ler credenciais SMTP.") };
  }
  const port = t.smtpPort ?? 587;
  return sendEmailViaSmtp(
    {
      host: t.smtpHost.trim(),
      port,
      secure: t.smtpSecure,
      user: t.smtpUser.trim(),
      pass,
    },
    {
      from: params.from ?? defaultFromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    },
  );
}

async function sendViaResend(input: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
  idempotencyKey?: string;
}): Promise<{ id?: string; error?: Error }> {
  try {
    const resend = getResendClient();
    const { data, error } = await withTimeout(
      resend.emails.send(
        {
          from: input.from,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      ),
      RESEND_SEND_TIMEOUT_MS,
      "Resend send",
    );
    if (error) {
      logger.error("Resend error", { err: error });
      return { error: classifyResendError(error) };
    }
    return { id: data?.id };
  } catch (err) {
    logger.error("Erro ao enviar email (Resend)", { err });
    if (err instanceof EmailSendError) return { error: err };
    // Falha de rede/runtime antes de obter resposta: vale tentar de novo.
    return { error: new EmailSendError(err instanceof Error ? err.message : String(err), true, { cause: err }) };
  }
}
