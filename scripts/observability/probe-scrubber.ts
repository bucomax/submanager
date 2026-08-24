/**
 * Prova que PII não sai para o Sentry. Roda o pipeline real de `scrubSentryEvent`
 * sobre um evento montado com dado sensível e falha se algo escapar.
 *
 * Uso: npx tsx scripts/observability/probe-scrubber.ts
 */
import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";
import { scrubSentryBreadcrumb, scrubSentryEvent } from "../../src/lib/observability/sentry-scrubber";

const event = {
  message: "falha ao salvar paciente 529.982.247-25",
  request: { url: "https://app.local/dashboard/contacts?q=Maria+Silva" },
  extra: {
    client: {
      documentId: "52998224725",
      phone: "(11) 98765-4321",
      email: "maria@exemplo.com",
      id: "cmg3k2p9x0001abcd",
    },
  },
  exception: {
    values: [{ type: "Error", value: "telefone 11987654321 inválido" }],
  },
} as unknown as ErrorEvent;

const scrubbed = JSON.stringify(scrubSentryEvent(event));

const leaks = [
  ["CPF", "52998224725"],
  ["CPF pontuado", "529.982.247-25"],
  ["telefone", "98765-4321"],
  ["e-mail", "maria@exemplo.com"],
  ["query string", "Maria+Silva"],
  // Celular sem formatação (11 dígitos) em texto livre não é coberto por regex de
  // telefone (ver comentário de `PHONE_HYPHEN_RE` em `sentry-scrubber.ts`) — cai no
  // `CPF_RE`, que aceita 11 dígitos sem pontuação. Sem esta entrada, a sonda passava
  // mesmo com `CPF_RE` degradado para exigir pontuação (regressão real, já reproduzida).
  ["celular sem formatação em texto livre", "11987654321"],
].filter(([, needle]) => scrubbed.includes(needle));

if (leaks.length > 0) {
  console.error("VAZAMENTO:", leaks.map(([label]) => label).join(", "));
  console.error(scrubbed);
  process.exit(1);
}

if (!scrubbed.includes("cmg3k2p9x0001abcd")) {
  console.error("REGRESSÃO: id interno foi redigido, diagnóstico fica cego.");
  process.exit(1);
}

// Breadcrumb de fetch (busca de paciente por nome, `src/app/api/v1/clients/route.ts`
// lê `q` do query string): nome não bate CPF/telefone/e-mail, então só sobra de
// pé se `stripQueryString` rodar sobre `data.url` — este caso é o que fecha essa
// lacuna, um nível abaixo do `request.url` provado acima.
const breadcrumb = {
  category: "fetch",
  data: { url: "https://app.local/api/v1/clients?q=Maria+Silva" },
} as unknown as Breadcrumb;

const scrubbedBreadcrumb = JSON.stringify(scrubSentryBreadcrumb(breadcrumb));

if (scrubbedBreadcrumb.includes("Maria+Silva")) {
  console.error("VAZAMENTO: nome do paciente sobreviveu na query string do breadcrumb.");
  console.error(scrubbedBreadcrumb);
  process.exit(1);
}

console.log("OK — nenhum dado sensível no evento; id interno preservado.");
