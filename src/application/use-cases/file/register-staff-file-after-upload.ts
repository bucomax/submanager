import { AuditEventType, Prisma } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { fileAssetPrismaRepository } from "@/infrastructure/repositories/file-asset.repository";
import {
  computeSha256HexForGcsObjectKey,
  deleteObjectFromBucket,
  getGcsObjectSize,
  keyMatchesFileRegisterIntent,
  publicUrlForKey,
  readFirstBytesFromGcsObject,
} from "@/infrastructure/storage/gcs-storage";
import { MAX_UPLOAD_SIZE_BYTES } from "@/lib/constants/file-upload";
import { MAGIC_BYTES_READ_SIZE, validateMagicBytes } from "@/lib/utils/magic-bytes";
import { postFileRegisterBodySchema } from "@/lib/validators/file";
import type { z } from "zod";

const GCS_SHA256_REGISTER_TIMEOUT_MS = 20_000;

export type PostFileRegisterInput = z.infer<typeof postFileRegisterBodySchema>;

export type RegisterStaffFileAfterUploadResult =
  | {
      ok: true;
      file: {
        id: string;
        r2Key: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sha256Hash: string | null;
        clientId: string | null;
        publicUrl: string | null;
        createdAt: string;
      };
    }
  | { ok: false; code: "INVALID_KEY" | "MIME_MISMATCH" | "FILE_TOO_LARGE"; declaredMime?: string }
  | { ok: false; code: "CONFLICT" | "DATABASE_SCHEMA_PENDING" | "INTERNAL" };

export async function runRegisterStaffFileAfterUpload(params: {
  tenantId: string;
  userId: string;
  data: PostFileRegisterInput;
}): Promise<RegisterStaffFileAfterUploadResult> {
  const { tenantId, userId, data } = params;

  if (!keyMatchesFileRegisterIntent(data.key, tenantId, data.clientId ?? null)) {
    return { ok: false, code: "INVALID_KEY" };
  }

  try {
    // O tamanho declarado pelo cliente não é confiável: usa o do objeto no bucket (fail-open sem GCS).
    const actualSizeBytes = await getGcsObjectSize(data.key);
    if (actualSizeBytes !== null && actualSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
      await deleteObjectFromBucket(data.key).catch((err) =>
        console.error("[registerStaffFileAfterUpload] oversize object cleanup failed:", err),
      );
      return { ok: false, code: "FILE_TOO_LARGE" };
    }

    try {
      const header = await Promise.race([
        readFirstBytesFromGcsObject(data.key, MAGIC_BYTES_READ_SIZE),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GCS_SHA256_REGISTER_TIMEOUT_MS)),
      ]);
      if (header) {
        const result = validateMagicBytes(header, data.mimeType);
        if (!result.valid) {
          return { ok: false, code: "MIME_MISMATCH", declaredMime: result.declaredMime };
        }
      }
    } catch {
      // GCS indisponível — fail-open
    }

    let sha256Hash: string | null = null;
    try {
      sha256Hash = await Promise.race([
        computeSha256HexForGcsObjectKey(data.key).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), GCS_SHA256_REGISTER_TIMEOUT_MS)),
      ]);
    } catch {
      sha256Hash = null;
    }

    const asset = await fileAssetPrismaRepository.createStaffUploadedAsset({
      tenantId,
      userId,
      r2Key: data.key,
      fileName: data.fileName,
      mimeType: data.mimeType,
      sizeBytes: actualSizeBytes ?? data.sizeBytes,
      clientId: data.clientId ?? null,
      sha256Hash,
    });

    if (asset.clientId) {
      await auditEventPrismaRepository.recordCanonical({
        tenantId,
        clientId: asset.clientId,
        patientPathwayId: null,
        actorUserId: userId,
        eventType: AuditEventType.FILE_UPLOADED_TO_CLIENT,
        payload: { fileAssetId: asset.id, mimeType: asset.mimeType },
      });
    }

    return {
      ok: true,
      file: {
        id: asset.id,
        r2Key: asset.r2Key,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sha256Hash: asset.sha256Hash,
        clientId: asset.clientId,
        publicUrl: publicUrlForKey(asset.r2Key),
        createdAt: asset.createdAt.toISOString(),
      },
    };
  } catch (err) {
    console.error("[registerStaffFileAfterUpload]", err);
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return { ok: false, code: "CONFLICT" };
      }
      if (err.code === "P2021" || err.code === "P2022") {
        return { ok: false, code: "DATABASE_SCHEMA_PENDING" };
      }
      if (err.code === "P2003") {
        console.error("[registerStaffFileAfterUpload] FK constraint (uploadedById / tenantId)", err.meta);
      }
    } else if (err instanceof Error) {
      console.error("[registerStaffFileAfterUpload]", err.message);
    }
    return { ok: false, code: "INTERNAL" };
  }
}
