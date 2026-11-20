/**
 * Falha de envio de e-mail com classificação para retry:
 * - `retryable` (429, 5xx, rede/timeout): vale reprocessar o job (BullMQ `attempts`).
 * - permanente (4xx de validação, endereço/credencial inválidos): reprocessar não adianta.
 */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmailSendError";
  }
}

/**
 * Lançado pelo processor quando algum destinatário falhou por motivo transitório (429/5xx/rede).
 * No worker BullMQ isso dispara o `attempts` configurado; no modo inline o emissor só registra o log.
 */
export class EmailDispatchRetryableError extends Error {
  constructor(
    readonly kind: string,
    readonly failures: number,
  ) {
    super(`${failures} e-mail(s) do job "${kind}" falharam com erro transitório.`);
    this.name = "EmailDispatchRetryableError";
  }
}

export function isRetryableEmailError(error: Error | undefined): boolean {
  return error instanceof EmailSendError && error.retryable;
}

/** Códigos de erro do Resend (`error.name`) que indicam falha transitória do lado deles. */
const RETRYABLE_RESEND_ERROR_NAMES = new Set([
  "rate_limit_exceeded",
  "application_error",
  "internal_server_error",
  "concurrent_idempotent_requests",
]);

const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429]);

type ResendErrorLike = { name?: string; message: string; statusCode?: number | null };

/** Classifica um erro devolvido pelo SDK Resend (`{ name, message, statusCode? }`). */
export function classifyResendError(error: ResendErrorLike): EmailSendError {
  const status = typeof error.statusCode === "number" ? error.statusCode : null;
  const retryable =
    (status !== null && (status >= 500 || RETRYABLE_HTTP_STATUS.has(status))) ||
    (error.name !== undefined && RETRYABLE_RESEND_ERROR_NAMES.has(error.name));
  return new EmailSendError(error.message, retryable);
}

/** Códigos do nodemailer/Node que indicam problema transitório de conexão. */
const TRANSIENT_SMTP_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNRESET",
  "ECONNREFUSED",
  "ESOCKET",
  "EDNS",
  "EPIPE",
]);

/** SMTP 4xx = falha temporária (greylist, caixa ocupada); 5xx e erros de auth/envelope são permanentes. */
export function isTransientSmtpFailure(err: { name?: string; code?: string; responseCode?: number }): boolean {
  if (err.name === "SmtpHostNotAllowedError") return false;
  if (typeof err.responseCode === "number") return err.responseCode >= 400 && err.responseCode < 500;
  return err.code !== undefined && TRANSIENT_SMTP_CODES.has(err.code);
}

/** Rejeita se `promise` não resolver em `timeoutMs` (o SDK Resend não aceita `AbortSignal`). */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new EmailSendError(`${label} timed out after ${timeoutMs}ms`, true)),
      timeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
