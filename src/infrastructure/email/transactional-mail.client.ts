import { prisma } from "@/infrastructure/database/prisma";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { sendEmailViaSmtp } from "@/infrastructure/email/smtp-send.client";
import { isResendApiConfigured } from "@/infrastructure/email/resend-domain.client";
import { Resend } from "resend";

const defaultFromEmail = process.env.EMAIL_FROM ?? "SubManager <onboarding@resend.dev>";
const resendApiKey = process.env.RESEND_API_KEY;

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
    console.error("SMTP password decrypt failed:", e);
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
}): Promise<{ id?: string; error?: Error }> {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) {
      console.error("Resend error:", error);
      return { error: new Error(error.message) };
    }
    return { id: data?.id };
  } catch (err) {
    console.error("Erro ao enviar email (Resend):", err);
    return { error: err instanceof Error ? err : new Error(String(err)) };
  }
}
