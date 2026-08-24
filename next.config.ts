import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const allowedIframeOrigins = process.env.ALLOWED_IFRAME_ORIGINS ?? "";
const frameSrc = ["'self'", ...allowedIframeOrigins.split(",").map(s => s.trim()).filter(Boolean)].join(" ");

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  `frame-src ${frameSrc}`,
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
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
