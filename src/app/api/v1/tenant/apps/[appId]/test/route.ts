import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import {
  assertTenantAdminOrSuper,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import { decryptConfigSecrets } from "@/infrastructure/crypto/app-config-secret";
import type { AppConfigField } from "@/types/api/apps-v1";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appId: string }> };

/**
 * POST /api/v1/tenant/apps/:appId/test
 *
 * Test connection to an app by calling its health check URL.
 * Requires: tenant_admin or super_admin + app active for tenant.
 *
 * The app must have `metadata.healthCheckUrl` set.
 * If the app has config with secret fields, they are decrypted and can be
 * interpolated into the health check URL or sent as Authorization header.
 */
export async function POST(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;

  const adminBlock = await assertTenantAdminOrSuper(
    auth.session!,
    tenantCtx.tenantId!,
    request,
    apiT,
  );
  if (adminBlock) return adminBlock;

  const { appId } = await context.params;

  // Load app by ID or slug
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app) {
    return jsonError("NOT_FOUND", "App não encontrado.", 404);
  }

  // Check for health check URL
  const metadata = app.metadata as Record<string, unknown> | null;
  const healthCheckUrl = metadata?.healthCheckUrl;
  if (!healthCheckUrl || typeof healthCheckUrl !== "string") {
    return jsonError(
      "NOT_SUPPORTED",
      "Este app não suporta teste de conexão.",
      422,
    );
  }

  // Load tenant app config (for auth header if needed)
  const tenantApp = await appPrismaRepository.findTenantApp(
    tenantCtx.tenantId!,
    app.id,
  );

  let authHeader: string | undefined;
  if (
    tenantApp?.configEncrypted &&
    typeof tenantApp.configEncrypted === "object" &&
    app.configSchema &&
    Array.isArray(app.configSchema)
  ) {
    const decrypted = decryptConfigSecrets(
      tenantApp.configEncrypted as Record<string, unknown>,
      app.configSchema as unknown as AppConfigField[],
    );

    // Use "apiKey" field as Bearer token if present
    const apiKey = decrypted.apiKey ?? decrypted.api_key ?? decrypted.token;
    if (typeof apiKey === "string" && apiKey.length > 0) {
      authHeader = `Bearer ${apiKey}`;
    }
  }

  // Call health check
  const startMs = Date.now();
  try {
    const headers: Record<string, string> = {
      "User-Agent": "SubManager-HealthCheck/1.0",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const res = await fetch(healthCheckUrl, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    const latencyMs = Date.now() - startMs;

    return jsonSuccess({
      status: res.ok ? "ok" : "error",
      httpStatus: res.status,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - startMs;
    const message =
      err instanceof Error ? err.message : "Erro desconhecido";

    return jsonSuccess({
      status: "error",
      httpStatus: null,
      latencyMs,
      error: message,
    });
  }
}
