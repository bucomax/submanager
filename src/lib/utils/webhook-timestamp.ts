/** Janela aceita entre o `timestamp` assinado do webhook e o relógio do servidor (proteção a replay). */
export const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

export type WebhookTimestampCheck = "fresh" | "stale" | "invalid";

/**
 * Valida o `timestamp` ISO enviado pelo parceiro (já coberto pela assinatura HMAC do corpo).
 * Ausente = `fresh` (o campo é opcional; replay continua barrado pela idempotência de `eventId`).
 */
export function checkWebhookTimestamp(
  timestamp: string | undefined,
  nowMs: number = Date.now(),
  toleranceMs: number = WEBHOOK_TIMESTAMP_TOLERANCE_MS,
): WebhookTimestampCheck {
  if (timestamp === undefined) return "fresh";
  const eventMs = Date.parse(timestamp);
  if (Number.isNaN(eventMs)) return "invalid";
  return Math.abs(nowMs - eventMs) <= toleranceMs ? "fresh" : "stale";
}
