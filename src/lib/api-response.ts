import * as Sentry from "@sentry/nextjs";
import type { ApiErrorBody, ApiErrorEnvelope, ApiSuccessEnvelope } from "@/lib/api/envelope";
import { createApiMeta } from "@/lib/api/envelope";
import { severityForHttpStatus, shouldReportHttpStatus } from "@/lib/observability/error-taxonomy";
import { REQUEST_ID_HEADER, currentRequestId } from "@/lib/observability/request-id";

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
  const requestId = currentRequestId();

  // `onRequestError` só enxerga exception que escapa do handler. Erro que o
  // handler tratou e converteu em envelope passaria despercebido sem isto.
  if (shouldReportHttpStatus(status)) {
    Sentry.withScope((scope) => {
      scope.setLevel(severityForHttpStatus(status));
      scope.setTags({ "error.code": code, request_id: requestId ?? "none" });
      scope.setFingerprint(["api-error", code, String(status)]);
      Sentry.captureMessage(`API ${status} ${code}`);
    });
  }

  return Response.json(body, {
    status,
    // O matcher do proxy exclui `/api/*`, então o carimbo dele nunca alcança rota de
    // API — este header é o único caminho do id até o browser. Sem id marcado (rota
    // pública, que não passa por `requireSessionOr401`) omite-se o header: id que
    // nenhum evento carrega é pior que id ausente.
    ...(requestId ? { headers: { [REQUEST_ID_HEADER]: requestId } } : {}),
  });
}
