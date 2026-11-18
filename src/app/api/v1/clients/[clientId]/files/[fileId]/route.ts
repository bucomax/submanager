import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_FILE_DELETE_ERRORS } from "@/lib/api/error-tables/client";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runDeleteClientFileAsset } from "@/application/use-cases/client/delete-client-file-asset";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";

export const dynamic = "force-dynamic";

export const DELETE = withTenantRoute(async ({ session, tenantId, apiT, params }) => {
  const { clientId, fileId } = params;

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const result = await runDeleteClientFileAsset({
    tenantId,
    clientId,
    fileId,
    actorUserId: session.user.id,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, CLIENT_FILE_DELETE_ERRORS, apiT);
  }

  return jsonSuccess({ message: apiT("success.clientFileDeleted") });
});
