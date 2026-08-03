import { jsonError, jsonSuccess } from "@/lib/api-response";
import { superAdminOr403, requireSessionOr401 } from "@/lib/auth/guards";
import { getApiT } from "@/lib/api/i18n";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import {
  isGcsConfigured,
  presignPutObject,
  publicUrlForKey,
} from "@/infrastructure/storage/gcs-storage";
import { randomUUID } from "crypto";
import { z } from "zod";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ appId: string }> };

const presignBodySchema = z.object({
  fileName: z.string().min(1).max(256),
  mimeType: z.string().min(1),
});

const registerBodySchema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().min(1),
});

/** POST — Step 1: presign icon upload, or Step 2: register uploaded icon. */
export async function POST(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const superBlock = await superAdminOr403(auth.session!, request, apiT);
  if (superBlock) return superBlock;

  if (!isGcsConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", "Storage não configurado.", 503);
  }

  const { appId } = await context.params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", "App não encontrado.", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON inválido.", 400);
  }

  // Step 2 — register uploaded file
  const registerParsed = registerBodySchema.safeParse(body);
  if (registerParsed.success) {
    const { key, fileName, mimeType, sizeBytes } = registerParsed.data;

    const { fileId } = await appPrismaRepository.setIconFromUpload(appId, {
      key,
      fileName,
      mimeType,
      sizeBytes,
      uploadedById: auth.session!.user.id,
    });

    return jsonSuccess({
      fileId,
      publicUrl: publicUrlForKey(key),
    });
  }

  // Step 1 — presign
  const presignParsed = presignBodySchema.safeParse(body);
  if (!presignParsed.success) {
    return jsonError("VALIDATION_ERROR", presignParsed.error.flatten().formErrors.join("; "), 422);
  }

  const ext = presignParsed.data.fileName.split(".").pop() ?? "png";
  const key = `apps/${appId}/icon-${randomUUID().slice(0, 8)}.${ext}`;
  const uploadUrl = await presignPutObject(key, presignParsed.data.mimeType);

  return jsonSuccess({
    key,
    uploadUrl,
    mimeType: presignParsed.data.mimeType,
    publicUrl: publicUrlForKey(key),
  });
}

/** DELETE — Remove icon */
export async function DELETE(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const superBlock = await superAdminOr403(auth.session!, request, apiT);
  if (superBlock) return superBlock;

  const { appId } = await context.params;
  await appPrismaRepository.setIcon(appId, null);
  return jsonSuccess({ removed: true });
}
