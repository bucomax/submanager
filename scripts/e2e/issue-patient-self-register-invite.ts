/**
 * Emite um convite de auto-cadastro público e imprime a URL (token de uso único).
 *
 * Uso:
 *   npm run e2e:issue-self-register-invite
 *   npm run e2e:issue-self-register-invite -- --tenant clinica-alpha
 *
 * Requer: DATABASE_URL no `.env`, tenant e pelo menos um membro (ex.: após `npm run db:seed`).
 */

import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { hashAuthToken } from "../../src/lib/auth/auth-token-hash";
import { loadRootEnv } from "../../e2e/load-root-env";

function argTenantSlug(): string {
  const i = process.argv.indexOf("--tenant");
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1]!.trim();
  return process.env.E2E_TENANT_SLUG ?? "clinica-alpha";
}

async function main() {
  loadRootEnv();
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL não definida.");
    process.exit(1);
  }

  const tenantSlug = argTenantSlug();
  const prisma = new PrismaClient();

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
    });
    if (!tenant) {
      console.error(`Tenant "${tenantSlug}" não encontrado ou inativo.`);
      process.exit(1);
    }

    const member = await prisma.tenantMembership.findFirst({
      where: { tenantId: tenant.id },
      select: { userId: true },
      orderBy: { id: "asc" },
    });
    if (!member) {
      console.error(`Nenhum membro no tenant ${tenantSlug}.`);
      process.exit(1);
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.patientSelfRegisterInvite.create({
      data: {
        tenantId: tenant.id,
        token: hashAuthToken(token),
        expiresAt,
        createdByUserId: member.userId,
        clientId: null,
      },
    });

    const base =
      process.env.PLAYWRIGHT_BASE_URL?.replace(/\/$/, "") ??
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    const path = `/${tenantSlug}/patient-self-register?token=${encodeURIComponent(token)}`;

    console.log("");
    console.log("Convite criado (uso único). Abra no navegador:");
    console.log(`${base}${path}`);
    console.log("");
    console.log("Token (se precisar só do valor):");
    console.log(token);
    console.log("");
  } finally {
    await prisma.$disconnect();
  }
}

void main();
