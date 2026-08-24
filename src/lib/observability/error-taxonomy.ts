/**
 * Decide o que vira evento no Sentry. Status de fluxo de negócio conhecido
 * (validação, sessão expirada, permissão, recurso ausente, conflito) não é
 * defeito: reportá-los afogaria o sinal real em ruído de operação normal.
 */
const EXPECTED_BUSINESS_STATUSES = new Set([400, 401, 403, 404, 409, 422]);

export function shouldReportHttpStatus(status: number): boolean {
  if (status < 400) return false;
  return !EXPECTED_BUSINESS_STATUSES.has(status);
}

export function severityForHttpStatus(status: number): "error" | "warning" {
  return status >= 500 ? "error" : "warning";
}
