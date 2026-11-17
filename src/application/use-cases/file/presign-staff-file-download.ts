import { AuditEventType } from "@prisma/client";
import type { Session } from "next-auth";

import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
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
  session: Session;
}): Promise<PresignStaffFileDownloadResult> {
  const { tenantId, fileId, actorUserId, session } = params;

  const asset = await fileAssetPrismaRepository.findForStaffDownloadPresign(tenantId, fileId);
  if (!asset) {
    return { ok: false, code: "NOT_FOUND" };
  }

  if (asset.clientId) {
    const visible = await findTenantClientVisibleToSession(session, tenantId, asset.clientId, { id: true });
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
