import { jsonError, jsonSuccess } from "@/lib/api-response";
import { superAdminOr403, requireSessionOr401 } from "@/lib/auth/guards";
import { getApiT } from "@/lib/api/i18n";
import { appPrismaRepository } from "@/infrastructure/repositories/app.repository";
import {
  isGcsConfigured,
  presignPutObject,
  publicUrlForKey,
} from "@/infrastructure/storage/gcs-storage";
import { reorderScreenshotsBodySchema } from "@/lib/validators/app";
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
  caption: z.record(z.string(), z.string()).optional(),
});

const deleteBodySchema = z.object({
  screenshotId: z.string().min(1),
});

/** POST — presign, register, or reorder screenshots. */
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

  // Reorder
  const reorderParsed = reorderScreenshotsBodySchema.safeParse(body);
  if (reorderParsed.success) {
    await appPrismaRepository.reorderScreenshots(appId, reorderParsed.data.order);
    return jsonSuccess({ reordered: true });
  }

  // Register uploaded screenshot
  const registerParsed = registerBodySchema.safeParse(body);
  if (registerParsed.success) {
    const { key, fileName, mimeType, sizeBytes, caption } = registerParsed.data;

    if (app.screenshots.length >= 8) {
      return jsonError("LIMIT_EXCEEDED", "Máximo de 8 screenshots.", 422);
    }

    const { fileId, screenshot } = await appPrismaRepository.addScreenshotFromUpload(
      appId,
      {
        key,
        fileName,
        mimeType,
        sizeBytes,
        uploadedById: auth.session!.user.id,
      },
      caption ?? undefined,
    );

    return jsonSuccess({
      screenshot: {
        id: screenshot.id,
        fileId,
        imageUrl: publicUrlForKey(key),
        caption: screenshot.caption,
        sortOrder: screenshot.sortOrder,
      },
    }, { status: 201 });
  }

  // Presign
  const presignParsed = presignBodySchema.safeParse(body);
  if (!presignParsed.success) {
    return jsonError("VALIDATION_ERROR", presignParsed.error.flatten().formErrors.join("; "), 422);
  }

  const ext = presignParsed.data.fileName.split(".").pop() ?? "png";
  const key = `apps/${appId}/screenshots/${randomUUID().slice(0, 8)}.${ext}`;
  const uploadUrl = await presignPutObject(key, presignParsed.data.mimeType);

  return jsonSuccess({
    key,
    uploadUrl,
    mimeType: presignParsed.data.mimeType,
    publicUrl: publicUrlForKey(key),
  });
}

/** DELETE — remove screenshot by ID in body. */
export async function DELETE(request: Request, context: RouteContext) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const superBlock = await superAdminOr403(auth.session!, request, apiT);
  if (superBlock) return superBlock;

  const { appId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "JSON inválido.", 400);
  }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "screenshotId obrigatório.", 422);
  }

  // Verify screenshot belongs to this app
  const screenshot = await appPrismaRepository.findScreenshotInApp(
    appId,
    parsed.data.screenshotId,
  );
  if (!screenshot) {
    return jsonError("NOT_FOUND", "Screenshot não encontrado.", 404);
  }

  await appPrismaRepository.deleteScreenshot(parsed.data.screenshotId);
  return jsonSuccess({ removed: true });
}
