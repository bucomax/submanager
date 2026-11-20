import { withTenantRoute } from "@/lib/api/route-handler";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { activateAppBodySchema } from "@/lib/validators/app";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import { mapAppToTenantDto } from "@/application/use-cases/admin/apps/map-app-dto";
import { encryptConfigSecrets, maskConfigSecrets } from "@/infrastructure/crypto/app-config-secret";
import type { AppConfigField } from "@/types/api/apps-v1";

export const dynamic = "force-dynamic";

/** Detalhe do app com status do tenant. */
export const GET = withTenantRoute<{ appId: string }>(async ({ tenantId, apiT, params }) => {
  const { appId } = params;
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app || !app.isPublished) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);
  }

  const tenantApp = await appPrismaRepository.findTenantApp(tenantId, app.id);

  // Build masked config summary
  let configSummary: Record<string, string> | null = null;
  if (
    tenantApp?.configEncrypted &&
    typeof tenantApp.configEncrypted === "object" &&
    app.configSchema &&
    Array.isArray(app.configSchema)
  ) {
    configSummary = maskConfigSecrets(
      tenantApp.configEncrypted as Record<string, unknown>,
      app.configSchema as unknown as AppConfigField[],
    );
  }

  return jsonSuccess({
    ...mapAppToTenantDto(app),
    tenantApp: tenantApp
      ? {
          id: tenantApp.id,
          appId: tenantApp.appId,
          status: tenantApp.status,
          activatedAt: tenantApp.activatedAt?.toISOString() ?? null,
          deactivatedAt: tenantApp.deactivatedAt?.toISOString() ?? null,
          configSummary,
          subscriptionStatus: tenantApp.subscriptionStatus,
          trialStartedAt: tenantApp.trialStartedAt?.toISOString() ?? null,
          trialEndsAt: tenantApp.trialEndsAt?.toISOString() ?? null,
          currentPeriodEnd: tenantApp.currentPeriodEnd?.toISOString() ?? null,
        }
      : null,
  });
});

/** Ativa app no tenant (tenant_admin ou super_admin). */
export const POST = withTenantRoute<{ appId: string }>(async ({ request, session, tenantId, apiT, params }) => {
  const { appId } = params;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body vazio é permitido para apps sem config
  }

  const parsed = activateAppBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  // Resolve app by ID or slug
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app || !app.isPublished) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFoundOrUnpublished"), 404);
  }

  // Encrypt secret fields before persisting
  let configToStore = parsed.data.config as Record<string, unknown> | undefined;
  if (configToStore) {
    if (app.configSchema && Array.isArray(app.configSchema)) {
      configToStore = encryptConfigSecrets(
        configToStore,
        app.configSchema as unknown as AppConfigField[],
      );
    }
  }

  const result = await appPrismaRepository.activateApp(
    tenantId,
    app.id,
    session.user.id,
    configToStore as Parameters<typeof appPrismaRepository.activateApp>[3],
  );

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFoundOrUnpublished"), 404);
  }

  return jsonSuccess({ status: result.tenantApp.status }, { status: 201 });
}, { role: "admin" });

/** Desativa app no tenant (tenant_admin ou super_admin). */
export const DELETE = withTenantRoute<{ appId: string }>(async ({ tenantId, apiT, params }) => {
  const { appId } = params;
  const appEntity = await appPrismaRepository.findByIdOrSlug(appId);
  if (!appEntity) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);
  }
  const result = await appPrismaRepository.deactivateApp(tenantId, appEntity.id);

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.appNotActiveInTenant"), 404);
  }

  return jsonSuccess({ status: result.tenantApp.status });
}, { role: "admin" });
