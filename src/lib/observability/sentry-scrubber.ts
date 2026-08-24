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

/** CPF com ou sem pontuação. Os lookarounds `(?<!\w)`/`(?!\w)` evitam casar dentro de cuid/uuid. */
const CPF_RE = /(?<!\w)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\w)/g;
/**
 * Telefone exige estrutura explícita — DDD entre parênteses ou hífen separando o
 * sufixo. Um padrão que aceitasse 8 dígitos soltos apagaria timestamp unix, número
 * de nota e valor em centavos, cegando o diagnóstico que este módulo existe para
 * preservar. Celular sem formatação (11 dígitos) já cai no `CPF_RE`, que roda antes.
 * Fixo de 10 dígitos sem formatação fica de fora de propósito: não dá para separá-lo
 * de um timestamp sem heurística frágil, e ele continua coberto pela denylist de
 * chaves e por `dataCollection`.
 */
const PHONE_PAREN_RE = /(?<!\w)\(\d{2}\)\s?9?\d{4}[-\s]?\d{4}(?!\w)/g;
const PHONE_HYPHEN_RE = /(?<!\w)(?:\+?55[\s-]?)?(?:\d{2}[\s-])?9?\d{4}-\d{4}(?!\w)/g;
const EMAIL_RE = /(?<!\w)[\w.+-]+@[\w-]+\.[\w.-]+(?!\w)/g;

export function redactSensitiveText(value: string): string {
  return value
    .replace(EMAIL_RE, REDACTED)
    .replace(CPF_RE, REDACTED)
    .replace(PHONE_PAREN_RE, REDACTED)
    .replace(PHONE_HYPHEN_RE, REDACTED);
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

/** Chaves de breadcrumb (fetch/xhr/navigation) que carregam URL completa, com query string. */
const URL_LIKE_BREADCRUMB_KEYS = ["url", "from", "to"] as const;

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // `console` repassa argumentos crus de `console.log`, sem controle de quem chamou.
  if (breadcrumb.category === "console") return null;

  if (breadcrumb.message) {
    breadcrumb.message = redactSensitiveText(breadcrumb.message);
  }
  if (breadcrumb.data) {
    // `stripQueryString` roda ANTES de `scrubValue`, não depois: busca por paciente
    // (`?q=Maria+Silva`) é nome, e `redactSensitiveText`/`scrubValue` só reconhecem
    // CPF, telefone e e-mail por regex — um nome passaria batido. Cortando a query
    // string estruturalmente primeiro, o resultado final não depende de o regex
    // cobrir esse formato; a ordem inversa deixaria a proteção refém do regex.
    for (const key of URL_LIKE_BREADCRUMB_KEYS) {
      const value = breadcrumb.data[key];
      if (typeof value === "string") {
        breadcrumb.data[key] = stripQueryString(value);
      }
    }
    breadcrumb.data = scrubValue(breadcrumb.data, new WeakSet()) as Breadcrumb["data"];
  }
  return breadcrumb;
}
