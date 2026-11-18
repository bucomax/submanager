import { actorFromSession } from "@/lib/auth/actor";
import { withSessionRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { SWITCH_ACTIVE_TENANT_ERRORS } from "@/lib/api/error-tables/auth";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { getSession } from "@/lib/auth/session";
import { postAuthContextBodySchema } from "@/lib/validators/tenant";
import { runSwitchActiveTenant } from "@/application/use-cases/auth/switch-active-tenant";

export const dynamic = "force-dynamic";

/** Define o tenant ativo (`User.activeTenantId`). Exige membership ou `super_admin`. */
export const POST = withSessionRoute(async ({ request, session, apiT }) => {
  const parsed = await parseJsonBody(request, postAuthContextBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runSwitchActiveTenant({
    actor: actorFromSession(session),
    tenantId: parsed.data.tenantId,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, SWITCH_ACTIVE_TENANT_ERRORS, apiT);
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
});
