import { logger } from "@/lib/observability/logger";
import { AuditEventType, Prisma, type PatientPortalFileReviewStatus } from "@prisma/client";

import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { clientPrismaRepository } from "@/infrastructure/repositories/client.repository";
import { fileAssetPrismaRepository } from "@/infrastructure/repositories/file-asset.repository";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { resolvePathwayNotificationTargetUserIds } from "@/infrastructure/notifications/resolve-notification-targets";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
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
import type { ApiT } from "@/lib/api/i18n";
import { patientPortalFileRegisterBodySchema } from "@/lib/validators/patient-portal-files";
import type { z } from "zod";

export type PatientPortalFileRegisterInput = z.infer<typeof patientPortalFileRegisterBodySchema>;

export type RegisterPatientPortalFileResult =
  | {
      ok: true;
      file: {
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        sha256Hash: string | null;
        patientPortalReviewStatus: PatientPortalFileReviewStatus;
        publicUrl: string | null;
        createdAt: string;
      };
    }
  | { ok: false; code: "INVALID_KEY" | "MIME_MISMATCH" | "FILE_TOO_LARGE"; declaredMime?: string }
  | { ok: false; code: "STORAGE_UNAVAILABLE" }
  | { ok: false; code: "CONFLICT" | "INTERNAL" };

export async function runRegisterPatientPortalFile(params: {
  tenantId: string;
  clientId: string;
  data: PatientPortalFileRegisterInput;
  /** i18n para notificação in-app */
  t: ApiT;
}): Promise<RegisterPatientPortalFileResult> {
  const { tenantId, clientId, data, t } = params;

  if (!keyMatchesFileRegisterIntent(data.key, tenantId, clientId)) {
    return { ok: false, code: "INVALID_KEY" };
  }

  // O tamanho declarado pelo cliente não é confiável: usa o do objeto no bucket (fail-closed: sem leitura do tamanho não registra).
  const actualSizeBytes = await getGcsObjectSize(data.key);
  if (actualSizeBytes === null) {
    return { ok: false, code: "STORAGE_UNAVAILABLE" };
  }
  if (actualSizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    await deleteObjectFromBucket(data.key).catch((err) =>
      logger.error("[registerPatientPortalFile] oversize object cleanup failed", { err }),
    );
    return { ok: false, code: "FILE_TOO_LARGE" };
  }

  try {
    try {
      const header = await readFirstBytesFromGcsObject(data.key, MAGIC_BYTES_READ_SIZE);
      if (header) {
        const mbResult = validateMagicBytes(header, data.mimeType);
        if (!mbResult.valid) {
          return { ok: false, code: "MIME_MISMATCH", declaredMime: mbResult.declaredMime };
        }
      }
    } catch {
      // GCS indisponível — fail-open
    }

    const sha256Hash = await computeSha256HexForGcsObjectKey(data.key);

    let asset: Awaited<ReturnType<typeof fileAssetPrismaRepository.createPatientPortalPendingAsset>>;
    try {
      asset = await fileAssetPrismaRepository.createPatientPortalPendingAsset({
        tenantId,
        clientId,
        r2Key: data.key,
        fileName: data.fileName,
        mimeType: data.mimeType,
        sizeBytes: actualSizeBytes,
        sha256Hash,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { ok: false, code: "CONFLICT" };
      }
      throw error;
    }

    await auditEventPrismaRepository.recordCanonical({
      tenantId,
      clientId,
      patientPathwayId: null,
      actorUserId: null,
      eventType: AuditEventType.PATIENT_PORTAL_FILE_SUBMITTED,
      payload: { fileAssetId: asset.id, mimeType: asset.mimeType },
    });

    const patientName =
      (await clientPrismaRepository.findClientNameById(tenantId, clientId)) ??
      t("notifications.patientPortalFallbackPatientName");

    const ppRow = await patientPathwayPrismaRepository.findActiveAssigneeByClientId(
      tenantId,
      clientId,
    );
    const targetUserIds = await resolvePathwayNotificationTargetUserIds({
      tenantId,
      type: "patient_portal_file_pending",
      currentStageAssigneeUserId: ppRow?.currentStageAssigneeUserId ?? null,
    });
    const tenant = await tenantPrismaRepository.findTenantNameAndSlugById(tenantId);
    const clinicName = tenant?.name?.trim() || "Clínica";

    notificationEmitter
      .emit({
        tenantId,
        type: "patient_portal_file_pending",
        title: t("notifications.patientPortalFileTitle"),
        body: t("notifications.patientPortalFileBody", {
          patientName,
          fileName: asset.fileName,
        }),
        targetUserIds,
        metadata: {
          clientId,
          fileAssetId: asset.id,
          ...(ppRow ? { patientPathwayId: ppRow.id } : {}),
        },
        correlationId: asset.id,
      })
      .catch((err) => logger.error("[registerPatientPortalFile] notification emit failed", { err }));

    if (targetUserIds.length > 0) {
      enqueueEmailDispatch(
        {
          kind: "file_pending_review_staff",
          tenantId,
          data: {
            patientName,
            fileName: asset.fileName,
            clientId,
            fileAssetId: asset.id,
            targetUserIds,
            clinicName,
          },
        },
        { jobId: `email|fpr|${tenantId}|${asset.id}`.replace(/:/g, "_") },
      ).catch((err) =>
        logger.error("[registerPatientPortalFile] staff email enqueue failed", { err }),
      );
    }

    return {
      ok: true,
      file: {
        id: asset.id,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
        sha256Hash: asset.sha256Hash,
        patientPortalReviewStatus: asset.patientPortalReviewStatus as PatientPortalFileReviewStatus,
        publicUrl: publicUrlForKey(asset.r2Key),
        createdAt: asset.createdAt.toISOString(),
      },
    };
  } catch (e) {
    logger.error("[registerPatientPortalFile]", { err: e });
    return { ok: false, code: "INTERNAL" };
  }
}
