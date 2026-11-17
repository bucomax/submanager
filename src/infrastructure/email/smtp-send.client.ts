import nodemailer from "nodemailer";

import { resolvePublicSmtpHost } from "@/infrastructure/email/smtp-host-guard";
import { isAllowedSmtpPort } from "@/lib/constants/smtp";

export type SmtpConnectionInput = {
  host: string;
  port: number;
  /** true = porta 465 (SSL direto); false = 587/STARTTLS */
  secure: boolean;
  user: string;
  pass: string;
};

const SMTP_TIMEOUT_MS = 10_000;

/** Erro com texto genérico seguro para devolver ao cliente (detalhes só em log). */
export const SMTP_GENERIC_ERROR_MESSAGE = "Não foi possível enviar via SMTP. Verifique host, porta e credenciais.";

/**
 * Envia e-mail transacional via SMTP (Gmail, Microsoft 365, etc.).
 * Retorna `id` a partir do `messageId` (Message-ID), para o log.
 * Host é resolvido e validado (sem IPs internos) antes de conectar; a conexão é fixada no IP validado.
 */
export async function sendEmailViaSmtp(
  connection: SmtpConnectionInput,
  message: { from: string; to: string; subject: string; html: string; text?: string },
): Promise<{ id?: string; error?: Error }> {
  try {
    if (!isAllowedSmtpPort(connection.port)) {
      console.warn("[smtp] blocked: port not allowed", { port: connection.port });
      return { error: new Error(SMTP_GENERIC_ERROR_MESSAGE) };
    }
    const resolvedIp = await resolvePublicSmtpHost(connection.host);

    const transporter = nodemailer.createTransport({
      host: resolvedIp,
      port: connection.port,
      secure: connection.secure,
      auth: { user: connection.user, pass: connection.pass },
      requireTLS: !connection.secure && connection.port === 587,
      tls: { servername: connection.host },
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
    const info = await transporter.sendMail({
      from: message.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    const raw = info.messageId?.trim() ?? "";
    const id = raw.replace(/^<|>$/g, "") || raw;
    return { id: id || undefined };
  } catch (err) {
    // Sem credenciais no log; detalhes ficam só no servidor.
    const e = err as { name?: string; code?: string; responseCode?: number; message?: string };
    console.error("[smtp] send failed", {
      host: connection.host,
      port: connection.port,
      name: e?.name,
      code: e?.code,
      responseCode: e?.responseCode,
      reason: e instanceof Error && e.name === "SmtpHostNotAllowedError" ? e.message : undefined,
    });
    return { error: new Error(SMTP_GENERIC_ERROR_MESSAGE, { cause: err }) };
  }
}
