/**
 * Decide o que vira evento no Sentry. Status de fluxo de negócio conhecido
 * (validação, sessão expirada, permissão, recurso ausente, conflito) não é
 * defeito: reportá-los afogaria o sinal real em ruído de operação normal.
 *
 * 429 e 412 entram pelo mesmo motivo, com uma nuance: são o sistema se
 * defendendo, não falhando. `otp/request` (rota pública, sem sessão) devolve 429
 * de rate limit — qualquer um pode martelar essa rota, e reportar cada 429 vira
 * um jeito de um atacante gastar quota do Sentry de graça. 412 (`PRECONDITION_FAILED`,
 * rotas de domínio de e-mail) é a mesma lógica de guarda de estado que já justifica
 * 409 na lista. `shouldReportHttpStatus` é usado também no client, então sem esta
 * entrada um usuário rate-limitado também gerava evento no browser.
 */
const EXPECTED_BUSINESS_STATUSES = new Set([400, 401, 403, 404, 409, 412, 422, 429]);

export function shouldReportHttpStatus(status: number): boolean {
  if (status < 400) return false;
  return !EXPECTED_BUSINESS_STATUSES.has(status);
}

export function severityForHttpStatus(status: number): "error" | "warning" {
  return status >= 500 ? "error" : "warning";
}
