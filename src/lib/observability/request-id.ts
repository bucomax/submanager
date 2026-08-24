import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";

/**
 * Elo entre os dois lados de uma mesma falha: o evento capturado no servidor e o
 * capturado no browser carregam a mesma tag `request_id`. Sem isso um relato de
 * bug só aponta para o sintoma que o usuário viu.
 *
 * O valor vive na isolation scope do Sentry, que o SDK do Next cria por
 * requisição. Header mutado no proxy não chega ao route handler, então a scope é
 * o único canal que atravessa middleware e handler sem tocar em toda rota.
 */
export const REQUEST_ID_HEADER = "x-request-id";

const REQUEST_ID_TAG = "request_id";
const API_ROUTE_TAG = "api.route";

export function resolveRequestId(request: Request): string {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER)?.trim();
  return fromHeader && fromHeader.length > 0 ? fromHeader : randomUUID();
}

/** Chamado no chokepoint de autenticação, por onde toda rota autenticada passa. */
export function tagRequestId(request: Request | undefined): string | null {
  if (!request) return null;
  const requestId = resolveRequestId(request);
  const scope = Sentry.getIsolationScope();
  scope.setTag(REQUEST_ID_TAG, requestId);
  try {
    // `request.url` já vem validado pelo runtime na imensa maioria dos casos, mas
    // este guard roda antes de tudo, inclusive do 401 — não pode ser o motivo de
    // uma rota autenticada quebrar por causa de uma tag de observabilidade.
    scope.setTag(API_ROUTE_TAG, new URL(request.url).pathname);
  } catch {
    // sem a tag, não sem a resposta — ver comentário acima
  }
  return requestId;
}

/** Chamado após o tenant ativo ser resolvido com sucesso, para filtrar Sentry por tenant. */
export function tagTenantId(tenantId: string): void {
  Sentry.getIsolationScope().setTag("tenant.id", tenantId);
}

export function currentRequestId(): string | null {
  const tag = Sentry.getIsolationScope().getScopeData().tags[REQUEST_ID_TAG];
  return typeof tag === "string" ? tag : null;
}
