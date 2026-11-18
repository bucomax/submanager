import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { STAFF_FILE_REGISTER_ERRORS } from "@/lib/api/error-tables/files";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { runRegisterStaffFileAfterUpload } from "@/application/use-cases/file/register-staff-file-after-upload";
import { postFileRegisterBodySchema } from "@/lib/validators/file";

export const dynamic = "force-dynamic";

/** Registra metadados após upload via URL pré-assinada (`POST /files/presign`). */
export const POST = withTenantRoute(async ({ request, session, tenantId, apiT }) => {
  const userId = session.user.id;

  const parsed = await parseJsonBody(request, postFileRegisterBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  if (parsed.data.clientId) {
    const c = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, parsed.data.clientId, {
      id: true,
    });
    if (!c) {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
    }
  }

  const result = await runRegisterStaffFileAfterUpload({
    tenantId,
    userId,
    data: parsed.data,
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, STAFF_FILE_REGISTER_ERRORS, apiT, {
      details: result.code === "MIME_MISMATCH" ? { declaredMime: result.declaredMime } : undefined,
    });
  }

  return jsonSuccess(
    {
      file: result.file,
    },
    { status: 201 },
  );
});
