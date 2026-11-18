import { withTenantRoute } from "@/lib/api/route-handler";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { generateAppScopedToken } from "@/lib/auth/app-scoped-token";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/tenant/apps/:appId/token
 *
 * Generate a short-lived, scoped JWT for an iframe app.
 * The token contains: userId, tenantId, appId, appSlug.
 * Validity: 15 minutes.
 *
 * Requires: authenticated user with active membership in tenant + app active for tenant.
 */
export const POST = withTenantRoute<{ appId: string }>(async ({ session, tenantId, apiT, params }) => {
  const { appId } = params;

  // Resolve app by ID or slug
  const app = await appPrismaRepository.findByIdOrSlug(appId);
  if (!app) {
    return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);
  }

  // Verify app is active for this tenant
  const tenantApp = await appPrismaRepository.findTenantApp(tenantId, app.id);
  if (!tenantApp || tenantApp.status !== "active") {
    return jsonError("NOT_FOUND", apiT("errors.appNotActiveInTenant"), 404);
  }

  const token = await generateAppScopedToken({
    userId: session.user.id,
    tenantId,
    appId: app.id,
    appSlug: app.slug,
  });

  return jsonSuccess({ token, expiresIn: 900 });
});
