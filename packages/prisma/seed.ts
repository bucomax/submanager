import { AppCategory, AppRenderMode, AppPricingModel, AppBillingInterval, GlobalRole, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { tenants } from "./seed/data";
import { seedConversations } from "./seed/seed-conversations";
import { seedTenant, upsertUser } from "./seed/seed-tenant";
import type { TenantContext } from "./seed/types";

const prisma = new PrismaClient();
const DEV_PASSWORD = "dev123456";

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);
  const superEmail = "dev@bucomax.local";
  const seedTenantSlugs = tenants.map((tenant) => tenant.slug);

  await prisma.tenant.deleteMany({
    where: {
      slug: {
        in: seedTenantSlugs,
      },
    },
  });

  const superUser = await upsertUser(prisma, {
    email: superEmail,
    name: "Dev Super Admin",
    passwordHash,
    globalRole: GlobalRole.super_admin,
  });

  const contexts: TenantContext[] = [];
  for (const seed of tenants) {
    contexts.push(
      await seedTenant(prisma, {
        seed,
        passwordHash,
        superUserId: superUser.id,
      }),
    );
  }

  const firstTenantId = contexts[0]?.tenantId ?? null;
  if (firstTenantId) {
    await prisma.user.update({
      where: { id: superUser.id },
      data: { activeTenantId: firstTenantId },
    });
  }

  // ── Seed Conversations (kanban de contatos multicanal — demo read-only) ──
  let conversationsSeeded = { conversationCount: 0, messageCount: 0 };
  if (contexts[0]) {
    conversationsSeeded = await seedConversations(prisma, contexts[0]);
  }

  // ── Seed Apps ──────────────────────────────────────────────────────────
  await prisma.app.deleteMany({
    where: { slug: { in: ["whatsapp-business", "ai-chatbot", "scheduling-pro"] } },
  });

  const seedApps = [
    {
      slug: "whatsapp-business",
      name: "WhatsApp Business",
      tagline: "Envio automático de mensagens e documentos via WhatsApp.",
      description:
        "Integração com a API do WhatsApp Business para envio de mensagens, documentos e notificações automáticas na transição de etapas.",
      category: AppCategory.communication,
      renderMode: AppRenderMode.internal,
      internalRoute: "/dashboard/apps/whatsapp-business",
      accentColor: "#25D366",
      developerName: "Bucomax",
      requiresConfig: false,
      configSchema: [
        {
          key: "phoneNumberId",
          label: { "pt-BR": "ID do número", en: "Phone Number ID" },
          type: "text",
          required: true,
          placeholder: "123456789012345",
        },
        {
          key: "accessToken",
          label: { "pt-BR": "Token de acesso", en: "Access Token" },
          type: "secret",
          required: true,
          helpText: {
            "pt-BR": "Token permanente da API do WhatsApp Business.",
            en: "Permanent token from WhatsApp Business API.",
          },
        },
      ],
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
      pricingModel: AppPricingModel.flat,
      priceInCents: 9900,
      priceCurrency: "BRL",
      billingInterval: AppBillingInterval.monthly,
      trialDays: 14,
    },
    {
      slug: "ai-chatbot",
      name: "Chatbot IA",
      tagline: "Atendimento inteligente com IA para triagem de pacientes.",
      description:
        "Chatbot com inteligência artificial para triagem inicial, coleta de dados e encaminhamento automático de pacientes.",
      category: AppCategory.ai,
      renderMode: AppRenderMode.iframe,
      iframeBaseUrl: "http://localhost:3000/app-poc/index.html",
      accentColor: "#8B5CF6",
      developerName: "Bucomax",
      requiresConfig: false,
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
      pricingModel: AppPricingModel.usage_based,
      priceInCents: 50,
      priceCurrency: "BRL",
      billingInterval: AppBillingInterval.monthly,
      trialDays: 7,
    },
    {
      slug: "scheduling-pro",
      name: "Agendamento Pro",
      tagline: "Agendamento online integrado ao fluxo do paciente.",
      description:
        "Sistema de agendamento que se integra à jornada do paciente, permitindo marcar consultas diretamente do painel.",
      category: AppCategory.scheduling,
      renderMode: AppRenderMode.external_link,
      iframeBaseUrl: "https://scheduling.example.com",
      accentColor: "#F59E0B",
      developerName: "ScheduleTech",
      developerUrl: "https://scheduletech.example.com",
      requiresConfig: false,
      isPublished: true,
      isFeatured: false,
      sortOrder: 3,
      pricingModel: AppPricingModel.free,
      billingInterval: AppBillingInterval.monthly,
      trialDays: 0,
    },
  ];

  for (const appData of seedApps) {
    await prisma.app.create({ data: appData as Parameters<typeof prisma.app.create>[0]["data"] });
  }

  console.log("Seed Apps:", seedApps.map((a) => a.slug));

  console.log("Seed OK:", {
    password: DEV_PASSWORD,
    superAdmin: superEmail,
    tenants: tenants.map((tenant) => ({
      slug: tenant.slug,
      admin: tenant.adminEmail,
      user: tenant.userEmail,
      pathways: tenant.pathways.length,
      clients: tenant.clients.length,
      suppliers: tenant.suppliers.length,
    })),
    conversations: conversationsSeeded,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
