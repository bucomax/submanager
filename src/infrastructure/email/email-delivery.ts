import { createHash } from "node:crypto";

import { hasDispatchKey, reserveDispatchKey } from "@/infrastructure/database/dispatch-key";
import { hashEmailForDispatchLog, recordEmailDispatchSent } from "@/infrastructure/email/email-dispatch-log";
import { isRetryableEmailError } from "@/infrastructure/email/email-send-error";
import { sendEmail } from "@/infrastructure/email/resend.client";
import { logger } from "@/lib/observability/logger";

/** Estado compartilhado de uma execução do job (um destinatário por chamada de `deliverEmail`). */
export type DeliveryContext = {
  tenantId: string;
  kind: string;
  from: string | undefined;
  useSmtp: boolean;
  /**
   * Identifica esta instância do job (só no worker BullMQ). Com ela, destinatários já enviados
   * numa tentativa anterior são pulados no retry em vez de receber o e-mail de novo.
   */
  runKey?: string;
  failures: { retryable: number; permanent: number };
};

export type EmailRecipient = {
  to: string;
  /** Referência sem PII para log (ex.: id do usuário). */
  ref: string;
};

type OutgoingMail = { subject: string; html: string; text: string };

function sentMarkerKey(runKey: string, to: string): string {
  return `email-sent|${runKey}|${hashEmailForDispatchLog(to)}`;
}

function persistDispatchLogIfSent(ctx: DeliveryContext, to: string, resendMessageId: string | undefined): void {
  if (!resendMessageId) return;
  void recordEmailDispatchSent({
    tenantId: ctx.tenantId,
    jobKind: ctx.kind,
    to,
    resendMessageId,
  }).catch((err) => {
    logger.error("[email-dispatch] EmailDispatchLog persist failed", { tenantId: ctx.tenantId, err });
  });
}

/**
 * Envia um e-mail a um destinatário, classificando a falha (retryable x permanente) em `ctx.failures`.
 * Nunca lança por falha de envio: o processor decide ao final se o job deve ser reprocessado.
 */
export async function deliverEmail(
  ctx: DeliveryContext,
  recipient: EmailRecipient,
  mail: OutgoingMail,
): Promise<void> {
  const markerKey = ctx.runKey ? sentMarkerKey(ctx.runKey, recipient.to) : null;
  if (markerKey && (await hasDispatchKey(markerKey))) {
    logger.debug("[email-dispatch] recipient already sent in a previous attempt; skipping", {
      tenantId: ctx.tenantId,
      kind: ctx.kind,
      recipientRef: recipient.ref,
    });
    return;
  }

  const sent = await sendEmail({
    to: recipient.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    from: ctx.from,
    tenantId: ctx.tenantId,
    useSmtp: ctx.useSmtp,
    // Resend limita a chave a 256 caracteres; o hash também evita PII no cabeçalho.
    idempotencyKey: markerKey ? createHash("sha256").update(markerKey, "utf8").digest("hex") : undefined,
  });

  if (sent.error) {
    const retryable = isRetryableEmailError(sent.error);
    if (retryable) ctx.failures.retryable += 1;
    else ctx.failures.permanent += 1;
    // Transitória: o retry decide; permanente: erro de verdade (vai ao Sentry).
    (retryable ? logger.warn : logger.error)("[email-dispatch] send failed", {
      tenantId: ctx.tenantId,
      kind: ctx.kind,
      recipientRef: recipient.ref,
      retryable,
      err: sent.error,
    });
    return;
  }

  if (markerKey) {
    await reserveDispatchKey(markerKey).catch((err) => {
      logger.warn("[email-dispatch] could not record sent marker; a retry may resend this recipient", {
        tenantId: ctx.tenantId,
        kind: ctx.kind,
        err,
      });
    });
  }
  persistDispatchLogIfSent(ctx, recipient.to, sent.id);
}
