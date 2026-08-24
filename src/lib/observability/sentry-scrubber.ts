import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

/**
 * Segunda camada de proteção de PII. A primeira é `dataCollection` em
 * `sentry-shared-options.ts`, que impede o SDK de coletar corpo, cookies e
 * variáveis locais. Este módulo cobre o que chega por `captureException`
 * manual, onde o autor da chamada controla o payload.
 *
 * Campo novo com dado sensível no schema Prisma exige entrada aqui.
 */

const REDACTED = "[redacted]";

export const SENSITIVE_KEY_DENYLIST = [
  "cpf",
  "documentid",
  "taxdocument",
  "phone",
  "whatsapp",
  "mobile",
  "birthdate",
  "email",
  "address",
  "zipcode",
  "notes",
  "note",
  "message",
  "content",
  "body",
  "description",
  "password",
  "token",
] as const;

/** CPF com ou sem pontuação. A borda `\D` evita casar dentro de cuid/uuid. */
const CPF_RE = /(?<!\w)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\w)/g;
/** Telefone BR: DDD opcional entre parênteses, 8 ou 9 dígitos. */
const PHONE_RE = /(?<!\w)(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9?\d{4}[-\s]?\d{4}(?!\w)/g;
const EMAIL_RE = /(?<!\w)[\w.+-]+@[\w-]+\.[\w.-]+(?!\w)/g;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED)
    .replace(CPF_RE, REDACTED)
    .replace(PHONE_RE, REDACTED);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_DENYLIST.some((denied) => normalized.includes(denied));
}

function scrubValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "string") return redactSensitiveText(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value as object)) return REDACTED;
  seen.add(value as object);

  if (Array.isArray(value)) return value.map((item) => scrubValue(item, seen));

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : scrubValue(item, seen);
  }
  return result;
}

/** Remove a query string: `?q=<nome do paciente>` é dado de paciente. */
function stripQueryString(url: string): string {
  const cut = url.indexOf("?");
  return cut === -1 ? url : url.slice(0, cut);
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  const seen = new WeakSet<object>();

  if (event.extra) {
    event.extra = scrubValue(event.extra, seen) as ErrorEvent["extra"];
  }

  if (event.request?.url) {
    event.request.url = stripQueryString(event.request.url);
  }

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (value.value) value.value = redactSensitiveText(value.value);
    }
  }

  if (event.message) {
    event.message = redactSensitiveText(event.message);
  }

  return event;
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // `console` repassa argumentos crus de `console.log`, sem controle de quem chamou.
  if (breadcrumb.category === "console") return null;

  if (breadcrumb.message) {
    breadcrumb.message = redactSensitiveText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    breadcrumb.data = scrubValue(breadcrumb.data, new WeakSet()) as Breadcrumb["data"];
  }
  return breadcrumb;
}
