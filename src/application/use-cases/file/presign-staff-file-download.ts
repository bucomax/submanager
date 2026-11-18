import { AuditEventType } from "@prisma/client";
import type { Actor } from "@/domain/auth/actor";
import { findTenantClientVisibleToActor } from "@/infrastructure/visibility/client-visibility-scope";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { fileAssetPrismaRepository } from "@/infrastructure/repositories/file-asset.repository";
import { presignGetObject } from "@/infrastructure/storage/gcs-storage";

const DOWNLOAD_URL_TTL_SECONDS = 300;

export type PresignStaffFileDownloadResult =
  | { ok: true; downloadUrl: string; expiresInSeconds: number }
  | { ok: false; code: "NOT_FOUND" };

export async function runPresignStaffFileDownload(params: {
  tenantId: string;
  fileId: string;
  actorUserId: string;
  actor: Actor;
}): Promise<PresignStaffFileDownloadResult> {
  const { tenantId, fileId, actorUserId, actor } = params;

  const asset = await fileAssetPrismaRepository.findForStaffDownloadPresign(tenantId, fileId);
  if (!asset) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (asset.clientId) {
    const visible = await findTenantClientVisibleToActor(actor, tenantId, asset.clientId, { id: true });
    if (!visible) {
      return { ok: false, code: "NOT_FOUND" };
    }
  }

  const downloadUrl = await presignGetObject(asset.r2Key, DOWNLOAD_URL_TTL_SECONDS);

  if (asset.clientId) {
    await auditEventPrismaRepository.recordCanonical({
      tenantId,
      clientId: asset.clientId,
      patientPathwayId: null,
      actorUserId,
      eventType: AuditEventType.FILE_DOWNLOADED_BY_STAFF,
      payload: { fileAssetId: asset.id, userId: actorUserId },
    });
  }

  return {
    ok: true,
    downloadUrl,
    expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
  };
}
