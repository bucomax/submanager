import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertActiveTenantMembership,
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { activateAppBodySchema } from "@/lib/validators/app";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import { mapAppToDto } from "@/application/use-cases/admin/apps/map-app-dto";
import { encryptConfigSecrets, maskConfigSecrets } from "@/infrastructure/crypto/app-config-secret";
import type { AppConfigField } from "@/types/api/apps-v1";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appId: string }> };

/** Detalhe do app com status do tenant. */
export async function GET(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const memberErr = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (memberErr) return memberErr;

  const { appId } = await context.params;
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app || !app.isPublished) {
    return jsonError("NOT_FOUND", "App não encontrado.", 404);
  }

  const tenantApp = await appPrismaRepository.findTenantApp(tenantCtx.tenantId!, app.id);

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
    ...mapAppToDto(app),
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
}

/** Ativa app no tenant (tenant_admin ou super_admin). */
export async function POST(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (adminBlock) return adminBlock;

  const { appId } = await context.params;

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
    return jsonError("NOT_FOUND", "App não encontrado ou não publicado.", 404);
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
    tenantCtx.tenantId!,
    app.id,
    auth.session!.user.id,
    configToStore as Parameters<typeof appPrismaRepository.activateApp>[3],
  );

  if (!result.ok) {
    return jsonError("NOT_FOUND", "App não encontrado ou não publicado.", 404);
  }

  return jsonSuccess({ status: result.tenantApp.status }, { status: 201 });
}

/** Desativa app no tenant (tenant_admin ou super_admin). */
export async function DELETE(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(auth.session!, tenantCtx.tenantId!, request, apiT);
  if (adminBlock) return adminBlock;

  const { appId } = await context.params;
  const appEntity = await appPrismaRepository.findByIdOrSlug(appId);
  if (!appEntity) {
    return jsonError("NOT_FOUND", "App não encontrado.", 404);
  }
  const result = await appPrismaRepository.deactivateApp(tenantCtx.tenantId!, appEntity.id);

  if (!result.ok) {
    return jsonError("NOT_FOUND", "App não está ativo neste tenant.", 404);
  }

  return jsonSuccess({ status: result.tenantApp.status });
}
