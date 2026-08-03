import NextAuth from "next-auth";
import { rateLimit } from "@/lib/api/rate-limit";
import { authOptions } from "@/lib/auth/auth-options";

/** Contexto do catch-all `/api/auth/[...nextauth]` — local a esta rota. */
type NextAuthRouteContext = { params: Promise<{ nextauth: string[] }> };

const handler = NextAuth(authOptions) as (
  request: Request,
  context: NextAuthRouteContext,
) => Promise<Response>;

/** Único endpoint do NextAuth que valida senha — os demais não precisam de throttle. */
const CREDENTIALS_CALLBACK_PATH = "/callback/credentials";

function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  return email.length > 0 ? email : null;
}

/**
 * Lê o e-mail do corpo do login em um **clone** do request: o NextAuth precisa
 * do body original intacto. Falha de parse não bloqueia o fluxo (só perde o
 * contador por e-mail; o contador por IP continua valendo).
 */
async function readCredentialsEmail(request: Request): Promise<string | null> {
  try {
    const cloned = request.clone();
    const contentType = cloned.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body: unknown = await cloned.json();
      const email = (body as { email?: unknown } | null)?.email;
      return typeof email === "string" ? normalizeEmail(email) : null;
    }

    const form = await cloned.formData();
    const email = form.get("email");
    return typeof email === "string" ? normalizeEmail(email) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request, context: NextAuthRouteContext) {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith(CREDENTIALS_CALLBACK_PATH)) {
    const limitedByIp = await rateLimit("auth");
    if (limitedByIp) return limitedByIp;

    // Por e-mail além do IP: rotação de IP sozinha não libera password spraying.
    const email = await readCredentialsEmail(request);
    if (email) {
      const limitedByEmail = await rateLimit("auth", `login:${email}`);
      if (limitedByEmail) return limitedByEmail;
    }
  }

  return handler(request, context);
}

export { handler as GET };
