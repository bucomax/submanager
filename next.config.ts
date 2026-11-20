import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const allowedIframeOrigins = process.env.ALLOWED_IFRAME_ORIGINS ?? "";
const frameSrc = ["'self'", ...allowedIframeOrigins.split(",").map(s => s.trim()).filter(Boolean)].join(" ");

const isProduction = process.env.NODE_ENV === "production";

/**
 * Hosts que o browser realmente chama (fora `self`):
 * - storage.googleapis.com: PUT em URL pré-assinada v4 do GCS (uploads);
 * - viacep.com.br: busca de CEP no formulário (`src/lib/utils/cep-lookup.ts`).
 * O Sentry passa pelo túnel `/monitoring` (self) e o Speed Insights por `/_vercel/*` (self).
 * Novo `fetch` do browser para outro host exige entrada aqui.
 */
const connectSrc = [
  "'self'",
  "https://storage.googleapis.com",
  "https://viacep.com.br",
  // HMR do `next dev` abre WebSocket; em produção não há nenhum.
  ...(isProduction ? [] : ["ws:", "wss:"]),
].join(" ");

// Limitação conhecida: 'unsafe-inline' segue em script-src; nonce exigiria proxy.ts + layout dinâmico.
// 'unsafe-eval' só em dev: o React em dev usa eval para reconstruir stack; produção não precisa.
const scriptSrc = ["'self'", ...(isProduction ? [] : ["'unsafe-eval'"]), "'unsafe-inline'"].join(" ");

const cspHeader = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  `frame-src ${frameSrc}`,
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // HSTS só em produção: em dev o `localhost` ficaria preso em HTTPS no browser.
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cloud Run: imagem enxuta com `server.js` + só o node_modules rastreado. Vercel ignora.
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  org: "tercon",
  project: "submanager",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Só loga o upload de source map em CI.
  silent: !process.env.CI,

  // Cobre mais arquivos de client em troca de build mais lento — stack trace legível
  // é o que dá valor ao vínculo erro→relato de bug.
  widenClientFileUpload: true,

  // `next build` no Next 16 roda Turbopack, onde o upload de source map acontece
  // depois da compilação em vez de via plugin de bundler. Sem isso, stack trace de
  // produção chega minificado.
  useRunAfterProductionCompileHook: true,

  // Túnel para o ingest do Sentry, contornando adblock no browser.
  // Exige `monitoring` excluído do matcher em `src/proxy.ts` — ver comentário lá.
  tunnelRoute: "/monitoring",
});
