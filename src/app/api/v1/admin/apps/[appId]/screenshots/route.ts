import { withSessionRoute } from "@/lib/api/route-handler";
import { readJsonBody } from "@/lib/api/parse-json-body";
import { formatZodIssues } from "@/lib/api/zod-error";
import { jsonError, jsonSuccess } from "@/lib/api-response";
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
export const POST = withSessionRoute<{ appId: string }>(async ({ request, session, apiT, params }) => {
  if (!isGcsConfigured()) {
    return jsonError("SERVICE_UNAVAILABLE", apiT("errors.storageNotConfigured"), 503);
  }

  const { appId } = params;
  const app = await appPrismaRepository.findById(appId);
  if (!app) return jsonError("NOT_FOUND", apiT("errors.appNotFound"), 404);

  const raw = await readJsonBody(request, apiT);
  if (raw.response) return raw.response;
  const body = raw.data;

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
      return jsonError("LIMIT_EXCEEDED", apiT("errors.screenshotsLimitExceeded"), 422);
    }

    const { fileId, screenshot } = await appPrismaRepository.addScreenshotFromUpload(
      appId,
      {
        key,
        fileName,
        mimeType,
        sizeBytes,
        uploadedById: session.user.id,
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
    return jsonError("VALIDATION_ERROR", formatZodIssues(presignParsed.error), 422);
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
}, { role: "super_admin" });

/** DELETE — remove screenshot by ID in body. */
export const DELETE = withSessionRoute<{ appId: string }>(async ({ request, apiT, params }) => {
  const { appId } = params;

  const raw = await readJsonBody(request, apiT);
  if (raw.response) return raw.response;
  const body = raw.data;

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", apiT("errors.screenshotIdRequired"), 422);
  }

  // Verify screenshot belongs to this app
  const screenshot = await appPrismaRepository.findScreenshotInApp(
    appId,
    parsed.data.screenshotId,
  );
  if (!screenshot) {
    return jsonError("NOT_FOUND", apiT("errors.screenshotNotFound"), 404);
  }

  await appPrismaRepository.deleteScreenshot(parsed.data.screenshotId);
  return jsonSuccess({ removed: true });
}, { role: "super_admin" });
