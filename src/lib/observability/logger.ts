import * as Sentry from "@sentry/nextjs";

import { currentRequestId } from "@/lib/observability/request-id";
import { redactSensitiveText, SENSITIVE_KEY_DENYLIST } from "@/lib/observability/sentry-scrubber";

/**
 * Logger de servidor: uma linha JSON por evento em stdout (12-factor), com `requestId` quando há
 * requisição em curso. Só para código server-side.
 *
 * LGPD: o contexto deve carregar IDs (tenantId, clientId, correlationId), nunca CPF, telefone, e-mail
 * ou texto clínico. Como rede de segurança, chaves da denylist do scrubber do Sentry e padrões de
 * CPF/e-mail/telefone em strings são redigidos.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/** `err` é serializado (nome, código, mensagem redigida) e, em `error`, enviado ao Sentry. */
export type LogContext = Record<string, unknown> & { err?: unknown };

const REDACTED = "[redacted]";
const MAX_ERROR_MESSAGE_LENGTH = 300;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_DENYLIST.some((denied) => normalized.includes(denied));
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object") return sanitizeRecord(value as Record<string, unknown>);
  return value;
}

function sanitizeRecord(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, isSensitiveKey(key) ? REDACTED : sanitizeValue(value)]),
  );
}

/** Erros de SDKs (ex.: Resend) chegam como `{ name, message }` sem ser `Error`. */
function describeNonError(err: unknown): string {
  if (err !== null && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}

function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) return { message: redactSensitiveText(describeNonError(err)).slice(0, MAX_ERROR_MESSAGE_LENGTH) };
  const code = (err as { code?: unknown }).code;
  return {
    name: err.name,
    ...(typeof code === "string" ? { code } : {}),
    message: redactSensitiveText(err.message).slice(0, MAX_ERROR_MESSAGE_LENGTH),
  };
}

function safeRequestId(): string | null {
  try {
    return currentRequestId();
  } catch {
    return null;
  }
}

export function buildLogLine(level: LogLevel, msg: string, context: LogContext = {}): Record<string, unknown> {
  const { err, ...rest } = context;
  const requestId = safeRequestId();
  return {
    level,
    time: new Date().toISOString(),
    msg: redactSensitiveText(msg),
    ...(requestId ? { requestId } : {}),
    ...sanitizeRecord(rest),
    ...(err !== undefined ? { err: serializeError(err) } : {}),
  };
}

function write(level: LogLevel, msg: string, context?: LogContext): void {
  process.stdout.write(`${JSON.stringify(buildLogLine(level, msg, context))}\n`);
  if (level === "error" && context?.err !== undefined) {
    const { err, ...rest } = context;
    Sentry.captureException(err, { extra: { msg, ...sanitizeRecord(rest) } });
  }
}

export const logger = {
  debug: (msg: string, context?: LogContext) => write("debug", msg, context),
  info: (msg: string, context?: LogContext) => write("info", msg, context),
  warn: (msg: string, context?: LogContext) => write("warn", msg, context),
  error: (msg: string, context?: LogContext) => write("error", msg, context),
};
