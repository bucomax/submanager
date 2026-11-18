import { parseJsonBody } from "@/lib/api/parse-json-body";
import { isGcsConfigured } from "@/infrastructure/storage/gcs-storage";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { runPresignPatientPortalFileDownload } from "@/application/use-cases/patient-portal/presign-patient-portal-file-download";
import { patientPortalFileDownloadPresignBodySchema } from "@/lib/validators/patient-portal-files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  if (!isGcsConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.storageNotConfigured"), 503);
  }

  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;

  const parsed = await parseJsonBody(request, patientPortalFileDownloadPresignBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { tenantId, clientId } = portalCtx.data.portal;

  const result = await runPresignPatientPortalFileDownload({
    tenantId,
    clientId,
    fileId: parsed.data.fileId,
  });

  if (!result.ok) {
    if (result.code === "NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.fileNotFound"), 404);
    }
    return jsonError("FORBIDDEN", apiT("errors.patientPortalFileNotAvailable"), 403);
  }

  return jsonSuccess({
    downloadUrl: result.downloadUrl,
    expiresInSeconds: result.expiresInSeconds,
  });
}
