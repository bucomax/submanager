import { actorFromSession } from "@/lib/auth/actor";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { isGcsConfigured } from "@/infrastructure/storage/gcs-storage";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runPresignStaffFileDownload } from "@/application/use-cases/file/presign-staff-file-download";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { postFileDownloadPresignBodySchema } from "@/lib/validators/file";

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

  const parsed = await parseJsonBody(request, postFileDownloadPresignBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runPresignStaffFileDownload({
    tenantId,
    fileId: parsed.data.fileId,
    actorUserId: auth.session!.user.id,
    actor: actorFromSession(auth.session!),
  });

  if (!result.ok) {
    return jsonError("NOT_FOUND", apiT("errors.fileNotFound"), 404);
  }

  return jsonSuccess({
    downloadUrl: result.downloadUrl,
    expiresInSeconds: result.expiresInSeconds,
  });
}
