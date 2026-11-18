import { parseJsonBody } from "@/lib/api/parse-json-body";
import {
  buildUploadObjectKey,
  isGcsConfigured,
  presignUploadUrl,
  publicUrlForKey,
} from "@/infrastructure/storage/gcs-storage";
import { rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { requireActivePatientPortalClient } from "@/lib/auth/patient-portal-request";
import { UPLOAD_URL_TTL_SECONDS } from "@/lib/constants/file-upload";
import { patientPortalFilePresignBodySchema } from "@/lib/validators/patient-portal-files";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  if (!isGcsConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.storageNotConfigured"), 503);
  }

  const portalCtx = await requireActivePatientPortalClient(request, apiT);
  if (!portalCtx.ok) return portalCtx.response;

  const { tenantId, clientId } = portalCtx.data.portal;
  const limited = await rateLimit("filePresign", `presign-patient:${tenantId}:${clientId}`);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, patientPortalFilePresignBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const key = buildUploadObjectKey({
    tenantId,
    originalFileName: parsed.data.fileName,
    clientId,
  });
  const { uploadUrl, uploadHeaders } = await presignUploadUrl(key, parsed.data.mimeType);

  return jsonSuccess({
    key,
    uploadUrl,
    uploadHeaders,
    mimeType: parsed.data.mimeType,
    publicUrl: publicUrlForKey(key),
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
}
