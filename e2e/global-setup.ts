import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

import { loadRootEnv } from "./load-root-env";
import { mintSessionCookie } from "./session-cookie";

const STATE_FILE = resolve(process.cwd(), "e2e", ".invite-state.json");
const SESSION_STATE_FILE = resolve(process.cwd(), "e2e", ".session-state.json");
/** Super admin seedado (`packages/prisma/seed.ts`) com `activeTenantId` = primeiro tenant. */
const E2E_SESSION_USER_EMAIL = "dev@bucomax.local";

/**
 * Cria um `PatientSelfRegisterInvite` novo (uso único) e grava token + slug em `e2e/.invite-state.json`.
 * Também emite um cookie de sessão NextAuth (`e2e/.session-state.json`) para specs autenticados.
 * Requer `DATABASE_URL` e tenant seedado (ex.: `clinica-alpha`).
 */
export default async function globalSetup(): Promise<void> {
  loadRootEnv();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente. Defina no .env para o globalSetup do Playwright.");
  }

  const tenantSlug = process.env.E2E_TENANT_SLUG ?? "clinica-alpha";
  const prisma = new PrismaClient();

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true },
    });
    if (!tenant) {
      throw new Error(
        `Tenant "${tenantSlug}" não encontrado ou inativo. Ajuste E2E_TENANT_SLUG ou rode npm run db:seed.`,
      );
    }

    const member = await prisma.tenantMembership.findFirst({
      where: { tenantId: tenant.id },
      select: { userId: true },
      orderBy: { id: "asc" },
    });
    if (!member) {
      throw new Error(`Nenhum TenantMembership para o tenant ${tenantSlug}. Rode npm run db:seed.`);
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenUi = randomBytes(32).toString("hex");
    const tokenApi = randomBytes(32).toString("hex");

    await prisma.patientSelfRegisterInvite.createMany({
      data: [
        {
          tenantId: tenant.id,
          token: tokenUi,
          expiresAt,
          createdByUserId: member.userId,
          clientId: null,
        },
        {
          tenantId: tenant.id,
          token: tokenApi,
          expiresAt,
          createdByUserId: member.userId,
          clientId: null,
        },
      ],
    });

    const e2eDir = resolve(process.cwd(), "e2e");
    if (!existsSync(e2eDir)) {
      mkdirSync(e2eDir, { recursive: true });
    }

    writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          tenantSlug,
          tokenUi,
          tokenApi,
          pathUi: `/${tenantSlug}/patient-self-register?token=${encodeURIComponent(tokenUi)}`,
        },
        null,
        2,
      ),
      "utf8",
    );

    console.log(
      `[playwright global-setup] Dois convites E2E criados (UI + API) para /${tenantSlug}/patient-self-register`,
    );

    const sessionCookie = await mintSessionCookie(prisma, E2E_SESSION_USER_EMAIL);
    writeFileSync(SESSION_STATE_FILE, JSON.stringify(sessionCookie, null, 2), "utf8");
    console.log(
      `[playwright global-setup] Cookie de sessão emitido para ${E2E_SESSION_USER_EMAIL}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}
