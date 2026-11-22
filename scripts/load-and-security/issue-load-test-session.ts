/**
 * Emite cookie de sessão NextAuth (JWT cifrado) para testes locais/staging:
 * load tests, `audit:api-latency`, `LOAD_TEST_COOKIE`, etc.
 *
 * Usa o mesmo `encode()` do NextAuth — não é um Bearer genérico; as rotas `/api/v1/*`
 * autenticam via `getServerSession` (cookie).
 *
 * Uso:
 *   npm run test:session-cookie
 *   LOAD_TEST_USER_EMAIL=admin@clinica.local npm run test:session-cookie
 *
 * Requer: `NEXTAUTH_SECRET`, `DATABASE_URL` (ou `.env` na raiz com ambos).
 * O usuário deve existir no banco (ex.: `npm run db:seed`).
 *
 * Saída:
 * - stderr: instruções
 * - stdout: uma única linha `export LOAD_TEST_COOKIE='...'` (para `eval` / pipe)
 * - arquivo `.load-test-cookie.export.sh` na raiz (gitignored), sem quebra de linha
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { encode, decode } from "next-auth/jwt";
import { PrismaClient } from "@prisma/client";

const MAX_AGE_SEC = 30 * 24 * 60 * 60;

function tryLoadEnvFromDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  const lines = readFileSync(p, "utf8").split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? "";
  const secure = url.startsWith("https://");
  return secure ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

async function main() {
  tryLoadEnvFromDotEnv();

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("Defina NEXTAUTH_SECRET (mesmo valor do app NextAuth).");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Defina DATABASE_URL ou use .env na raiz do repo.");
    process.exit(1);
  }

  const email = (
    process.env.LOAD_TEST_USER_EMAIL ?? "dev@bucomax.local"
  )
    .trim()
    .toLowerCase();

  const prisma = new PrismaClient();
  const user = await prisma.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      globalRole: true,
    },
  });
  await prisma.$disconnect();

  if (!user) {
    console.error(`Usuário não encontrado: ${email} (rode db:seed ou ajuste LOAD_TEST_USER_EMAIL).`);
    process.exit(1);
  }

  const payload = {
    sub: user.id,
    userId: user.id,
    globalRole: user.globalRole,
    name: user.name ?? null,
    email: user.email ?? null,
    picture: user.image ?? null,
    invalid: false as const,
  };

  const sessionToken = await encode({
    secret,
    token: payload,
    maxAge: MAX_AGE_SEC,
  });

  const roundTrip = await decode({ secret, token: sessionToken });
  if (!roundTrip?.sub || roundTrip.sub !== user.id) {
    console.error("Falha ao validar token emitido (decode/rechecar secret).");
    process.exit(1);
  }

  const cookieName = sessionCookieName();
  const token = String(sessionToken).replace(/\s+/g, "");
  const cookieHeader = `${cookieName}=${token}`;
  const exportLine = `export LOAD_TEST_COOKIE='${cookieHeader}'`;
  const exportPath = resolve(process.cwd(), ".load-test-cookie.export.sh");

  console.error(`
=== Cookie de sessão para testes ===
Usuário:  ${user.email} (${user.globalRole})
Cookie:   ${cookieName}
`);

  writeFileSync(exportPath, `${exportLine}\n`, "utf8");
  console.error(`Arquivo (uma linha, fácil de \`source\`): ${exportPath}`);
  console.error("  source ./.load-test-cookie.export.sh");
  console.error(`
Exemplos:
  source ./.load-test-cookie.export.sh && npm run audit:api-latency
  LOAD_TEST_COOKIE='…' npm run load:test

Somente dev/staging. Não commite o .sh nem compartilhe o valor (equivale a login).

Linha export (também no stdout, por último — útil para pipe):
`);

  process.stdout.write(`${exportLine}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
