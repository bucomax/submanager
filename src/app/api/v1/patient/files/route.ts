import { formatZodIssues } from "@/lib/api/zod-error";
import { buildPagination } from "@/lib/api/pagination";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { listPatientPortalFilesPage } from "@/application/use-cases/patient-portal/list-patient-portal-files-page";
import { runRegisterPatientPortalFile } from "@/application/use-cases/patient-portal/register-patient-portal-file";
import { clientDetailQuerySchema } from "@/lib/validators/client-detail-query";
import { patientPortalFileRegisterBodySchema } from "@/lib/validators/patient-portal-files";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const apiT = await getApiT(request);
  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;

  const url = new URL(request.url);
  const parsedQ = clientDetailQuerySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsedQ.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsedQ.error), 422);
  }
  const { page, limit } = parsedQ.data;
  const { tenantId, clientId } = portalCtx.data.portal;

  const { totalItems, rows } = await listPatientPortalFilesPage({
    tenantId,
    clientId,
    page,
    limit,
  });

  return jsonSuccess({
    data: rows.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      sha256Hash: r.sha256Hash,
      createdAt: r.createdAt.toISOString(),
      patientPortalReviewStatus: r.patientPortalReviewStatus,
    })),
    pagination: buildPagination(page, limit, totalItems),
  });
}

export async function POST(request: Request) {
  const trans = await getApiT(request);
  const portalCtx = await requireActivePatientPortalClient(request, trans);
  if (!portalCtx.ok) return portalCtx.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", trans("errors.invalidJson"), 400);
  }

  const parsed = patientPortalFileRegisterBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { tenantId, clientId } = portalCtx.data.portal;

  const result = await runRegisterPatientPortalFile({
    tenantId,
    clientId,
    data: parsed.data,
    t: trans,
  });

  if (!result.ok) {
    if (result.code === "INVALID_KEY") {
      return jsonError("FORBIDDEN", trans("errors.invalidObjectKey"), 403);
    }
    if (result.code === "MIME_MISMATCH") {
      return jsonError(
        "VALIDATION_ERROR",
        trans("errors.fileMimeTypeMismatch"),
        422,
        { declaredMime: result.declaredMime },
      );
    }
    if (result.code === "FILE_TOO_LARGE") {
      return jsonError("PAYLOAD_TOO_LARGE", trans("errors.fileTooLarge"), 413);
    }
    if (result.code === "STORAGE_UNAVAILABLE") {
      return jsonError("SERVICE_UNAVAILABLE", trans("errors.storageNotConfigured"), 503);
    }
    if (result.code === "CONFLICT") {
      return jsonError("CONFLICT", trans("errors.fileAlreadyRegistered"), 409);
    }
    return jsonError("INTERNAL_ERROR", trans("errors.internalError"), 500);
  }

  return jsonSuccess(
    {
      file: result.file,
    },
    { status: 201 },
  );
}
