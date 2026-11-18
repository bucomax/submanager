import { actorFromSession } from "@/lib/auth/actor";
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
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { UPLOAD_URL_TTL_SECONDS } from "@/lib/constants/file-upload";
import { postFilePresignBodySchema } from "@/lib/validators/file";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const apiT = await getApiT(request);
  if (!isGcsConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.storageNotConfigured"), 503);
  }

  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const ctx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (ctx.response) return ctx.response;
  const { tenantId } = ctx;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantId, request, apiT);
  if (forbidden) return forbidden;

  const limited = await rateLimit("filePresign", `presign:${tenantId}:${auth.session!.user.id}`);
  if (limited) return limited;

  const parsed = await parseJsonBody(request, postFilePresignBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  if (parsed.data.clientId) {
    const c = await findTenantClientVisibleToActor(actorFromSession(auth.session!), tenantId, parsed.data.clientId, {
      id: true,
    });
    if (!c) {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
    }
  }

  const key = buildUploadObjectKey({
    tenantId,
    originalFileName: parsed.data.fileName,
    clientId: parsed.data.clientId,
    category: parsed.data.purpose === "avatar" ? "avatars" : undefined,
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
