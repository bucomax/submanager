/**
 * Opções comuns às três inicializações do Sentry (server, edge, client).
 *
 * O SDK v10 liga `dataCollection` inteiro por padrão: corpo de request e response,
 * query params, cookies, headers e variáveis locais de cada stack frame. Num SaaS
 * clínico isso significa CPF, telefone e prontuário saindo do domínio a cada
 * exception. Aqui o default é invertido — nada de PII sai, e cada categoria que
 * voltar a ser coletada exige decisão explícita registrada no diff.
 *
 * Sem `NEXT_PUBLIC_SENTRY_DSN` o SDK fica desligado e nada é enviado (dev local).
 */

import { scrubSentryBreadcrumb, scrubSentryEvent } from "@/lib/observability/sentry-scrubber";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";

/**
 * Amostragem de tracing. Fora de produção o padrão é `0`: dev não deve consumir
 * quota nem poluir o sinal do ambiente real.
 */
function resolveTracesSampleRate(): number {
  const parsed = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return process.env.NODE_ENV === "production" ? 0.1 : 0;
}

function resolveEnvironment(): string {
  return (
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() ||
    process.env.SENTRY_ENVIRONMENT?.trim() ||
    process.env.NODE_ENV
  );
}

export const sentrySharedOptions = {
  dsn,
  enabled: dsn.length > 0,
  environment: resolveEnvironment(),
  tracesSampleRate: resolveTracesSampleRate(),
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: false, response: false },
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
    genAI: { inputs: false, outputs: false },
  },
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubSentryBreadcrumb,
};
