import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import { decryptConfigSecrets } from "@/infrastructure/crypto/app-config-secret";
import type { AppConfigField } from "@/types/api/apps-v1";

export const dynamic = "force-dynamic";

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
export const POST = withTenantRoute<{ appId: string }>(async ({ tenantId, apiT, params }) => {
  const { appId } = params;

  // Load app by ID or slug
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);
  }

  // Check for health check URL
  const metadata = app.metadata as Record<string, unknown> | null;
  const healthCheckUrl = metadata?.healthCheckUrl;
  if (!healthCheckUrl || typeof healthCheckUrl !== "string") {
    return jsonError(
      "NOT_SUPPORTED",
      apiT("errors.appTestNotSupported"),
      422,
    );
  }

  // Load tenant app config (for the Authorization header if needed)
  const tenantApp = await appPrismaRepository.findTenantApp(
    tenantId,
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
}, { role: "admin" });
