import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_PORTAL_LINK_ERRORS } from "@/lib/api/error-tables/client";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { runCreateClientPortalLink } from "@/application/use-cases/client/create-client-portal-link";
import { postClientPortalLinkBodySchema } from "@/lib/validators/patient-portal";

export const dynamic = "force-dynamic";

export const POST = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { clientId } = params;

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
    name: true,
    email: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const parsed = await parseJsonBody(request, postClientPortalLinkBodySchema, apiT, { issues: "fields", allowEmptyBody: true });
  if (parsed.response) return parsed.response;

  const sendEmailFlag = parsed.data.sendEmail !== false;
  const email = client.email?.trim() ?? "";

  if (sendEmailFlag && !email) {
    return jsonError("VALIDATION_ERROR", apiT("errors.patientPortalEmailRequired"), 422);
  }

  const result = await runCreateClientPortalLink({
    tenantId,
    actorUserId: session.user.id,
    client,
    sendEmailFlag,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, CLIENT_PORTAL_LINK_ERRORS, apiT);
  }

  return jsonSuccess(result.data, { status: 201 });
});
