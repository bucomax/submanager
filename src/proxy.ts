import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";
import createMiddleware from "next-intl/middleware";

import { routing } from "@/i18n/routing";

// ---------------------------------------------------------------------------
// i18n middleware (aplicado em todas as rotas de página)
// ---------------------------------------------------------------------------
const intlMiddleware = createMiddleware(routing);

// ---------------------------------------------------------------------------
// Auth middleware (next-auth wrapping intl)
// ---------------------------------------------------------------------------
const authMiddleware = withAuth(
  function onSuccess(req) {
    return intlMiddleware(req);
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token && token.invalid !== true,
    },
    pages: { signIn: "/login" },
  },
);

// ---------------------------------------------------------------------------
// Rotas públicas — sem exigência de sessão
// ---------------------------------------------------------------------------

/** Rotas exatas (sem filhos) que são públicas. */
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/patient",
  "/patient-self-register",
]);

/** Prefixos cujos filhos também são públicos (`/auth/forgot-password`, `/legal/terms`, …). */
const PUBLIC_PREFIXES = [
  "/auth/",
  "/legal/",
];

/** Padrão: `/{tenantSlug}/patient` e `/{tenantSlug}/patient-self-register` (portal do paciente). */
const TENANT_SCOPED_PUBLIC_RE = /^\/[^/]+\/(patient|patient-self-register)(\/|$)/;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (TENANT_SCOPED_PUBLIC_RE.test(pathname)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Proxy (middleware entry-point — Next.js 16)
// ---------------------------------------------------------------------------
export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // `withAuth` é assíncrono por dentro (`getToken`) e, para rota interna do próprio
  // next-auth (signIn/error/`_next`), devolve `undefined` em vez de Response — daí o
  // `await` e o fallback abaixo, em vez do cast direto pra `Response` que havia antes.
  const response = isPublicPath(pathname)
    ? intlMiddleware(req)
    : await (authMiddleware as unknown as (r: NextRequest) => Promise<Response | undefined>)(req);

  // Sem carimbo de `x-request-id` aqui: resposta de página não passa por
  // `tagRequestId`, então nada no Sentry usaria este valor — era um header que não
  // correlacionava com nada (ver `report-api-error.ts`, que só lê o header de
  // resposta de API, carimbado por `jsonError`/`jsonSuccess`).
  return response ?? NextResponse.next();
}

export const config = {
  // `monitoring` é o túnel do Sentry (`tunnelRoute` no next.config.ts). Precisa ficar
  // fora do matcher, não em PUBLIC_EXACT: liberar a rota ainda a entregaria ao
  // middleware do next-intl, que a trata como página e responde 404. O rewrite do
  // Sentry só é alcançado quando o proxy não toca na requisição.
  matcher: ["/((?!api|_next|_vercel|monitoring|.*\\..*).*)"],
};
