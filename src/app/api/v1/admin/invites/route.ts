import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { INVITE_MEMBER_ERRORS } from "@/lib/api/error-tables/admin";
import { parseJsonBody } from "@/lib/api/parse-json-body";
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

  const parsed = await parseJsonBody(request, adminInviteSchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { email, name, tenantId, role } = parsed.data;

  const perm = await assertTenantInvitePermission(auth.session!, tenantId, request, apiT);
  if (perm) return perm;

  const outcome = await runInviteTenantMember({ email, name, tenantId, role }, { actorUserId: auth.session!.user.id });

  if (!outcome.ok) {
    return mapUseCaseError(outcome.code, INVITE_MEMBER_ERRORS, apiT);
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
