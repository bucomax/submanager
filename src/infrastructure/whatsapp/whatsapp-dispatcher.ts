import { logger } from "@/lib/observability/logger";
import { AuditEventType, DispatchStatus } from "@prisma/client";

import type {
  IWhatsAppDispatcher,
  WhatsAppButtonReply,
  WhatsAppDispatchInput,
  WhatsAppDispatchResult,
  WhatsAppStatusUpdate,
} from "@/application/ports/whatsapp-dispatcher.port";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { prisma } from "@/infrastructure/database/prisma";
import { getPhoneNumberInfo } from "@/infrastructure/whatsapp/whatsapp-cloud-client";
import {
  loadAlreadySent,
  sendConfirmationMessage,
  sendDocument,
  type SendContext,
} from "@/infrastructure/whatsapp/whatsapp-dispatch-steps";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";

/** Maps Meta status webhook values to our DispatchStatus enum. */
const STATUS_MAP: Record<string, DispatchStatus> = {
  sent: DispatchStatus.SENT,
  delivered: DispatchStatus.DELIVERED,
  read: DispatchStatus.READ,
  failed: DispatchStatus.FAILED,
};

/** Ordered rank for idempotent status progression. */
const STATUS_RANK: Record<DispatchStatus, number> = {
  [DispatchStatus.QUEUED]: 0,
  [DispatchStatus.SENT]: 1,
  [DispatchStatus.DELIVERED]: 2,
  [DispatchStatus.READ]: 3,
  [DispatchStatus.CONFIRMED]: 4,
  [DispatchStatus.FAILED]: 5,
};

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export const whatsappDispatcher: IWhatsAppDispatcher = {
  async dispatch(input: WhatsAppDispatchInput): Promise<WhatsAppDispatchResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessTokenEnc: true,
      },
    });

    // Graceful skip: tenant not configured
    if (
      !tenant?.whatsappEnabled ||
      !tenant.whatsappPhoneNumberId ||
      !tenant.whatsappAccessTokenEnc
    ) {
      return { dispatchIds: [] };
    }

    const ctx: SendContext = {
      input,
      phoneNumberId: tenant.whatsappPhoneNumberId,
      accessToken: decryptTenantSecret(tenant.whatsappAccessTokenEnc),
    };
    // Em retry, documentos já aceitos pela Meta nesta transição não são reenviados.
    const alreadySent = await loadAlreadySent(input);
    const dispatchIds: string[] = [];
    let deliveredCount = 0;

    for (const doc of input.documents) {
      if (alreadySent.documentKeys.has(doc.r2Key)) {
        deliveredCount += 1;
        continue;
      }
      const { dispatchId, delivered } = await sendDocument(ctx, doc);
      dispatchIds.push(dispatchId);
      if (delivered) deliveredCount += 1;
    }

    // Resumo só se algum documento saiu (N = enviados de fato) e se ainda não foi enviado.
    if (deliveredCount === 0) {
      logger.warn("[whatsapp] no document was delivered; skipping confirmation message", {
        stageTransitionId: input.stageTransitionId,
      });
    } else if (!alreadySent.summarySent) {
      dispatchIds.push(await sendConfirmationMessage(ctx, deliveredCount));
    }

    return { dispatchIds };
  },

  async handleStatusUpdate(update: WhatsAppStatusUpdate): Promise<void> {
    const dispatch = await prisma.channelDispatch.findFirst({
      where: { tenantId: update.tenantId, externalMessageId: update.externalMessageId },
    });
    if (!dispatch) return;

    const newStatus = STATUS_MAP[update.status];
    if (!newStatus) return;

    // Idempotency: only progress forward (except FAILED overrides anything)
    if (
      newStatus !== DispatchStatus.FAILED &&
      STATUS_RANK[newStatus] <= STATUS_RANK[dispatch.status]
    ) {
      return;
    }

    const timestampField =
      update.status === "sent"
        ? "sentAt"
        : update.status === "delivered"
          ? "deliveredAt"
          : update.status === "read"
            ? "readAt"
            : undefined;

    await prisma.channelDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: newStatus,
        ...(timestampField
          ? { [timestampField]: new Date(update.timestamp) }
          : {}),
        ...(update.errorCode
          ? {
              errorDetail: `${update.errorCode}: ${update.errorTitle ?? "unknown"}`,
            }
          : {}),
      },
    });

    const auditType =
      update.status === "sent"
        ? AuditEventType.WHATSAPP_DISPATCH_SENT
        : update.status === "delivered"
          ? AuditEventType.WHATSAPP_DISPATCH_DELIVERED
          : update.status === "read"
            ? AuditEventType.WHATSAPP_DISPATCH_READ
            : AuditEventType.WHATSAPP_DISPATCH_FAILED;

    await auditEventPrismaRepository.recordCanonical({
      tenantId: dispatch.tenantId,
      clientId: dispatch.clientId,
      patientPathwayId: null,
      actorUserId: null,
      eventType: auditType,
      payload: {
        channelDispatchId: dispatch.id,
        externalMessageId: update.externalMessageId,
      },
    });
  },

  async handleButtonReply(reply: WhatsAppButtonReply): Promise<void> {
    // The button reply context references the original interactive message ID
    const dispatch = await prisma.channelDispatch.findFirst({
      where: { tenantId: reply.tenantId, externalMessageId: reply.externalMessageId },
    });
    if (!dispatch) return;

    // Already confirmed — idempotent
    if (dispatch.status === DispatchStatus.CONFIRMED) return;

    await prisma.channelDispatch.update({
      where: { id: dispatch.id },
      data: {
        status: DispatchStatus.CONFIRMED,
        confirmedAt: new Date(reply.timestamp),
        confirmationPayload: reply.buttonPayload,
      },
    });

    // Also mark all document dispatches of the same transition as confirmed
    await prisma.channelDispatch.updateMany({
      where: {
        tenantId: dispatch.tenantId,
        stageTransitionId: dispatch.stageTransitionId,
        id: { not: dispatch.id },
        status: { not: DispatchStatus.FAILED },
      },
      data: {
        status: DispatchStatus.CONFIRMED,
        confirmedAt: new Date(reply.timestamp),
      },
    });

    await auditEventPrismaRepository.recordCanonical({
      tenantId: dispatch.tenantId,
      clientId: dispatch.clientId,
      patientPathwayId: null,
      actorUserId: null,
      eventType: AuditEventType.WHATSAPP_PATIENT_CONFIRMED,
      payload: {
        channelDispatchId: dispatch.id,
        stageTransitionId: dispatch.stageTransitionId,
        buttonPayload: reply.buttonPayload,
      },
    });
  },

  async testConnection(tenantId: string): Promise<{ ok: boolean; error?: string }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        whatsappPhoneNumberId: true,
        whatsappAccessTokenEnc: true,
      },
    });

    if (!tenant?.whatsappPhoneNumberId || !tenant.whatsappAccessTokenEnc) {
      return { ok: false, error: "WhatsApp credentials not configured." };
    }

    try {
      const accessToken = decryptTenantSecret(tenant.whatsappAccessTokenEnc);
      await getPhoneNumberInfo(tenant.whatsappPhoneNumberId, accessToken);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { whatsappVerifiedAt: new Date() },
      });

      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : "Connection test failed.";
      return { ok: false, error };
    }
  },
};
