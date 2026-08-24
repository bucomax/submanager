import * as Sentry from "@sentry/nextjs";
import type { ApiErrorBody, ApiErrorEnvelope, ApiSuccessEnvelope } from "@/lib/api/envelope";
import { createApiMeta } from "@/lib/api/envelope";
import { severityForHttpStatus, shouldReportHttpStatus } from "@/lib/observability/error-taxonomy";
import { currentRequestId } from "@/lib/observability/request-id";

function meta() {
  return createApiMeta();
}

/**
 * Resposta de sucesso padronizada (`200` por padrão; use `init.status` para `201`, etc.).
 */
export function jsonSuccess<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccessEnvelope<T> = { success: true, data, meta: meta() };
  return Response.json(body, { status: 200, ...init });
}

/**
 * Resposta de erro padronizada.
 * @param details — opcional (ex. resultado de `safeParse` ou lista de campos).
 */
export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): Response {
  const error: ApiErrorBody =
    details !== undefined ? { code, message, details } : { code, message };
  const body: ApiErrorEnvelope = { success: false, error, meta: meta() };

  // `onRequestError` só enxerga exception que escapa do handler. Erro que o
  // handler tratou e converteu em envelope passaria despercebido sem isto.
  if (shouldReportHttpStatus(status)) {
    Sentry.withScope((scope) => {
      scope.setLevel(severityForHttpStatus(status));
      scope.setTags({ "error.code": code, request_id: currentRequestId() ?? "none" });
      scope.setFingerprint(["api-error", code, String(status)]);
      Sentry.captureMessage(`API ${status} ${code}`);
    });
  }

  return Response.json(body, { status });
}
