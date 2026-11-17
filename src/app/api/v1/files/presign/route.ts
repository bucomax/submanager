import { formatZodIssues } from "@/lib/api/zod-error";
import {
  buildUploadObjectKey,
  isGcsConfigured,
  presignUploadUrl,
  publicUrlForKey,
} from "@/infrastructure/storage/gcs-storage";
import { rateLimit } from "@/lib/api/rate-limit";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = postFilePresignBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  if (parsed.data.clientId) {
    const c = await findTenantClientVisibleToSession(auth.session!, tenantId, parsed.data.clientId, {
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
