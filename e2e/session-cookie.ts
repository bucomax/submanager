import { encode } from "next-auth/jwt";
import type { PrismaClient } from "@prisma/client";

const MAX_AGE_SEC = 30 * 24 * 60 * 60;

/**
 * Mesma estratégia de `scripts/load-and-security/issue-load-test-session.ts`:
 * cifra um JWT com o `encode()` do próprio NextAuth (não é um Bearer genérico —
 * as rotas autenticam via `getServerSession`/cookie). `NEXTAUTH_URL` deste
 * ambiente é `http://localhost:3000`, então o cookie não leva `__Secure-`.
 */
const SESSION_COOKIE_NAME = "next-auth.session-token";

export type SessionCookie = { name: string; value: string };

/**
 * Emite o cookie de sessão para um usuário já seedado no banco. Usado pelo
 * `globalSetup` do Playwright — nenhum spec deste repo faz login pela UI.
 */
export async function mintSessionCookie(
  prisma: PrismaClient,
  email: string,
): Promise<SessionCookie> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET ausente. Defina no .env para o globalSetup do Playwright.");
  }

  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: { id: true, email: true, name: true, image: true, globalRole: true },
  });
  if (!user) {
    throw new Error(`Usuário "${email}" não encontrado. Rode npm run db:seed.`);
  }

  const token = await encode({
    secret,
    token: {
      sub: user.id,
      userId: user.id,
      globalRole: user.globalRole,
      name: user.name ?? null,
      email: user.email ?? null,
      picture: user.image ?? null,
      invalid: false as const,
    },
    maxAge: MAX_AGE_SEC,
  });

  return { name: SESSION_COOKIE_NAME, value: String(token).replace(/\s+/g, "") };
}
