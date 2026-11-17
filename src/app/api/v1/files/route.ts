import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { runRegisterStaffFileAfterUpload } from "@/application/use-cases/file/register-staff-file-after-upload";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postFileRegisterBodySchema } from "@/lib/validators/file";

export const dynamic = "force-dynamic";

/** Registra metadados após upload via URL pré-assinada (`POST /files/presign`). */
export async function POST(request: Request) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;
  const userId = auth.session!.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postFileRegisterBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", parsed.error.flatten().formErrors.join("; "), 422);
  }

  if (parsed.data.clientId) {
    const c = await findTenantClientVisibleToSession(auth.session!, tenantId, parsed.data.clientId, {
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
    if (result.code === "INVALID_KEY") {
      return jsonError("FORBIDDEN", apiT("errors.invalidObjectKey"), 403);
    }
    if (result.code === "MIME_MISMATCH") {
      return jsonError(
        "VALIDATION_ERROR",
        apiT("errors.fileMimeTypeMismatch"),
        422,
        { declaredMime: result.declaredMime },
      );
    }
    if (result.code === "FILE_TOO_LARGE") {
      return jsonError("PAYLOAD_TOO_LARGE", apiT("errors.fileTooLarge"), 413);
    }
    if (result.code === "CONFLICT") {
      return jsonError("CONFLICT", apiT("errors.fileAlreadyRegistered"), 409);
    }
    if (result.code === "DATABASE_SCHEMA_PENDING") {
      return jsonError("DATABASE_SCHEMA_PENDING", apiT("errors.databaseSchemaOutdated"), 503);
    }
    return jsonError("INTERNAL_ERROR", apiT("errors.internalError"), 500);
  }

  return jsonSuccess(
    {
      file: result.file,
    },
    { status: 201 },
  );
}
