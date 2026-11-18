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
});

/** POST — Step 1: presign icon upload, or Step 2: register uploaded icon. */
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

  // Step 2 — register uploaded file
  const registerParsed = registerBodySchema.safeParse(body);
  if (registerParsed.success) {
    const { key, fileName, mimeType, sizeBytes } = registerParsed.data;

    const { fileId } = await appPrismaRepository.setIconFromUpload(appId, {
      key,
      fileName,
      mimeType,
      sizeBytes,
      uploadedById: session.user.id,
    });

    return jsonSuccess({
      fileId,
      publicUrl: publicUrlForKey(key),
    });
  }

  // Step 1 — presign
  const presignParsed = presignBodySchema.safeParse(body);
  if (!presignParsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(presignParsed.error), 422);
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
}, { role: "super_admin" });

/** DELETE — Remove icon */
export const DELETE = withSessionRoute<{ appId: string }>(async ({ params }) => {
  const { appId } = params;
  await appPrismaRepository.setIcon(appId, null);
  return jsonSuccess({ removed: true });
}, { role: "super_admin" });
