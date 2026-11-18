import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { buildPatientSelfRegisterUrl } from "@/infrastructure/email/resend.client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runCreatePatientSelfRegisterInvite } from "@/application/use-cases/client/create-patient-self-register-invite";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { postPatientSelfRegisterInviteBodySchema } from "@/lib/validators/client";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const parsed = await parseJsonBody(request, postPatientSelfRegisterInviteBodySchema, apiT, { allowEmptyBody: true });
  if (parsed.response) return parsed.response;

  let scopedClientId: string | undefined;
  if (parsed.data.clientId) {
    const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, parsed.data.clientId, {
      id: true,
    });
    if (!client) {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
    }
    scopedClientId = client.id;
  }

  const result = await runCreatePatientSelfRegisterInvite({
    tenantId,
    createdByUserId: session.user.id,
    clientId: scopedClientId ?? null,
  });

  if (!result.ok) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.tenantNotFound"), 503);
  }

  return jsonSuccess(
    {
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      registerUrl: buildPatientSelfRegisterUrl(result.token, result.tenantSlug),
    },
    { status: 201 },
  );
});
