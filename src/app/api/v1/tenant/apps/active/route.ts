import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonSuccess } from "@/lib/api-response";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import type { ActiveAppDto } from "@/types/api/apps-v1";

export const dynamic = "force-dynamic";

/** Lista apps ativos do tenant (para sidebar). */
export const GET = withTenantRoute(async ({ tenantId }) => {
  const rows = await appPrismaRepository.listActiveTenantApps(tenantId);

  const apps: ActiveAppDto[] = rows.map((ta) => ({
    slug: ta.app.slug,
    name: ta.app.name,
    iconUrl: ta.app.iconFile?.r2Key ?? null,
    accentColor: ta.app.accentColor,
    renderMode: ta.app.renderMode,
    internalRoute: ta.app.internalRoute,
  }));

  return jsonSuccess({ apps });
});
