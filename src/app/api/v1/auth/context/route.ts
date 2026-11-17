import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireSessionOr401 } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { postAuthContextBodySchema } from "@/lib/validators/tenant";
import { runSwitchActiveTenant } from "@/application/use-cases/auth/switch-active-tenant";

export const dynamic = "force-dynamic";

/** Define o tenant ativo (`User.activeTenantId`). Exige membership ou `super_admin`. */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postAuthContextBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const result = await runSwitchActiveTenant({
    session: auth.session!,
    tenantId: parsed.data.tenantId,
  });

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
    }
    if (result.code === "TENANT_INACTIVE") {
      return jsonError("TENANT_INACTIVE", apiT("errors.tenantInactive"), 403);
    }
    return jsonError("FORBIDDEN", apiT("errors.forbiddenTenantAccess"), 403);
  }

  const fresh = await getSession();

  return jsonSuccess({
    tenantId: result.tenantId,
    tenantRole: result.tenantRole,
    user: fresh?.user
      ? {
          id: fresh.user.id,
          email: fresh.user.email,
          globalRole: fresh.user.globalRole,
          tenantId: fresh.user.tenantId,
          tenantRole: fresh.user.tenantRole,
        }
      : undefined,
  });
}
