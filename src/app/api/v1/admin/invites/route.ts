import { isEmailConfigured } from "@/infrastructure/email/resend.client";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { assertTenantInvitePermission, requireSessionOr401 } from "@/lib/auth/guards";
import { adminInviteSchema, runInviteTenantMember } from "@/application/use-cases/admin/invite-tenant-member";

export const dynamic = "force-dynamic";

/** Convida usuário ao tenant: cria conta sem senha e envia link para definir senha (Resend). */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  if (!isEmailConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.invitesNotConfigured"), 503);
  }

  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = adminInviteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  const { email, name, tenantId, role } = parsed.data;

  const perm = await assertTenantInvitePermission(auth.session!, tenantId, request, apiT);
  if (perm) return perm;

  const outcome = await runInviteTenantMember({ email, name, tenantId, role });

  if (!outcome.ok) {
    switch (outcome.code) {
      case "EMAIL_NOT_CONFIGURED":
        return jsonError("SERVICE_UNAVAILABLE", apiT("errors.invitesNotConfigured"), 503);
      case "TENANT_NOT_FOUND":
        return jsonError("NOT_FOUND", apiT("errors.tenantNotFound"), 404);
      case "EMAIL_DISABLED_ACCOUNT":
        return jsonError("CONFLICT", apiT("errors.emailDisabledAccount"), 409);
      case "USER_ALREADY_MEMBER":
        return jsonError("CONFLICT", apiT("errors.userAlreadyMember"), 409);
    }
  }

  const { data } = outcome;
  const message =
    data.kind === "readded" ? apiT("success.memberReadded") : apiT("success.inviteSent");
  return jsonSuccess(
    {
      message,
      email: data.email,
      userId: data.userId,
      emailDispatched: data.kind === "invite" ? data.emailDispatched : false,
      emailError: data.kind === "invite" ? (data.emailError ?? null) : null,
    },
    { status: 201 },
  );
}
