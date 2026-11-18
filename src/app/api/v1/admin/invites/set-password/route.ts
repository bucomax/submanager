import { withSessionRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { SET_INVITEE_PASSWORD_ERRORS } from "@/lib/api/error-tables/admin";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonSuccess } from "@/lib/api-response";
import { rateLimit } from "@/lib/api/rate-limit";
import { assertTenantInvitePermission } from "@/lib/auth/guards";
import { adminSetInviteePasswordSchema } from "@/lib/validators/auth";
import { runAdminSetInviteePassword } from "@/application/use-cases/admin/set-invitee-password";

export const dynamic = "force-dynamic";

/**
 * Define a primeira senha de um convidado pendente (sem senha, sem membership em outro tenant, não super_admin).
 * Usuários que já têm senha devem usar o fluxo de e-mail de redefinição (403 USER_NOT_ELIGIBLE).
 * Requer: super_admin ou tenant_admin do tenant informado.
 * O actor não pode redefinir a própria senha por esta rota.
 */
export const POST = withSessionRoute(async ({ request, session, apiT }) => {
  const parsed = await parseJsonBody(request, adminSetInviteePasswordSchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { userId, tenantId, password } = parsed.data;

  const perm = await assertTenantInvitePermission(session, tenantId, request, apiT);
  if (perm) return perm;

  const rateLimited = await rateLimit("api", session.user.id);
  if (rateLimited) return rateLimited;

  const result = await runAdminSetInviteePassword({
    userId,
    tenantId,
    password,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, SET_INVITEE_PASSWORD_ERRORS, apiT);
  }

  return jsonSuccess({ userId: result.userId });
});
