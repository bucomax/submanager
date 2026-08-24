import * as Sentry from "@sentry/nextjs";
import type { AxiosError } from "axios";
import { severityForHttpStatus } from "@/lib/observability/error-taxonomy";
import { REQUEST_ID_HEADER } from "@/lib/observability/request-id";
import { useLastErrorStore } from "@/shared/stores/use-last-error-store";
import type { ApiErrorEnvelope } from "@/shared/types/api/v1";

/**
 * Agrupa por rota e código, nunca por mensagem: a mensagem varia com o locale do
 * usuário, o que espalharia o mesmo defeito em vários issues no Sentry.
 */
export function buildApiErrorFingerprint(
  method: string,
  requestUrl: string,
  code: string,
): string[] {
  return ["api-client", method, requestUrl, code];
}

/**
 * Captura a falha de API no Sentry e guarda o vínculo para o widget de feedback.
 * Só faz sentido no browser — o chamador garante a guarda de `window`.
 */
export function reportApiError(error: AxiosError<ApiErrorEnvelope>, status: number): void {
  const requestUrl = error.config?.url ?? "unknown";
  const code = error.response?.data?.error?.code ?? "UNKNOWN";
  const requestId = error.response?.headers?.[REQUEST_ID_HEADER] ?? null;

  const eventId = Sentry.withScope((scope) => {
    scope.setLevel(severityForHttpStatus(status));
    scope.setTags({
      "error.code": code,
      "api.route": requestUrl,
      request_id: requestId ?? "none",
    });
    scope.setFingerprint(buildApiErrorFingerprint(error.config?.method ?? "get", requestUrl, code));
    return Sentry.captureException(error);
  });

  // `route` é a tela em que o usuário estava, não o endpoint: é o que o triador
  // precisa para reproduzir. O endpoint já vive na tag `api.route`.
  useLastErrorStore.getState().setLastError({
    sentryEventId: eventId ?? null,
    requestId,
    route: window.location.pathname,
    capturedAt: Date.now(),
  });
}
