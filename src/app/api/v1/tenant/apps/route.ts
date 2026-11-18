import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonSuccess } from "@/lib/api-response";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import type { AppCatalogCardDto } from "@/types/api/apps-v1";
import type { AppCategory } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Catálogo de apps publicados com status de ativação do tenant. */
export const GET = withTenantRoute(async ({ request, tenantId }) => {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") as AppCategory | null;
  const search = url.searchParams.get("search") ?? undefined;

  const [publishedApps, tenantApps] = await Promise.all([
    appPrismaRepository.listPublished({ category: category ?? undefined, search }),
    appPrismaRepository.listTenantApps(tenantId),
  ]);

  const tenantAppMap = new Map(tenantApps.map((ta) => [ta.appId, ta]));

  const featured: AppCatalogCardDto[] = [];
  const byCategory: Partial<Record<AppCategory, AppCatalogCardDto[]>> = {};

  for (const app of publishedApps) {
    const ta = tenantAppMap.get(app.id);
    const card: AppCatalogCardDto = {
      id: app.id,
      slug: app.slug,
      name: app.name,
      tagline: app.tagline,
      iconUrl: app.iconFile?.r2Key ?? null,
      accentColor: app.accentColor,
      developerName: app.developerName,
      category: app.category,
      isFeatured: app.isFeatured,
      pricingModel: app.pricingModel,
      priceInCents: app.priceInCents,
      priceCurrency: app.priceCurrency,
      billingInterval: app.billingInterval,
      trialDays: app.trialDays,
      tenantStatus: ta?.status ?? null,
      subscriptionStatus: ta?.subscriptionStatus ?? null,
    };

    if (app.isFeatured) featured.push(card);

    if (!byCategory[app.category]) byCategory[app.category] = [];
    byCategory[app.category]!.push(card);
  }

  return jsonSuccess({ featured, byCategory });
});
