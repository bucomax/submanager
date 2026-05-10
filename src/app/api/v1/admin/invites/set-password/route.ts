import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { rateLimit } from "@/lib/api/rate-limit";
import { assertTenantInvitePermission, requireSessionOr401 } from "@/lib/auth/guards";
import { adminSetInviteePasswordSchema } from "@/lib/validators/auth";
import { runAdminSetInviteePassword } from "@/application/use-cases/admin/set-invitee-password";

export const dynamic = "force-dynamic";

/**
 * Define senha manualmente para um convidado pendente (sem senha).
 * Requer: super_admin ou tenant_admin do tenant informado.
 */
export async function POST(request: Request) {
  const apiT = await getApiT(request);

  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const session = auth.session!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = adminSetInviteePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

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
    switch (result.code) {
      case "USER_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.userNotFound"), 404);
      case "USER_HAS_PASSWORD":
        return jsonError("CONFLICT", apiT("errors.userAlreadyHasPassword"), 409);
      case "MEMBERSHIP_MISSING":
        return jsonError("NOT_FOUND", apiT("errors.membershipNotFound"), 404);
    }
  }

  return jsonSuccess({ userId: result.userId });
}
