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
import { presignGetObject } from "@/infrastructure/storage/gcs-storage";
import {
  getPhoneNumberInfo,
  sendDocumentMessage,
  sendInteractiveButtonMessage,
} from "@/infrastructure/whatsapp/whatsapp-cloud-client";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";

/** Presigned URL TTL for documents sent via WhatsApp (30 minutes). */
const PRESIGN_TTL_SECONDS = 30 * 60;

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

    const accessToken = decryptTenantSecret(tenant.whatsappAccessTokenEnc);
    const phoneNumberId = tenant.whatsappPhoneNumberId;
    const dispatchIds: string[] = [];

    // --- Send each document ---
    for (const doc of input.documents) {
      let presignedUrl: string | undefined;
      let externalMessageId: string | undefined;
      let errorDetail: string | undefined;
      let status: DispatchStatus = DispatchStatus.QUEUED;

      try {
        presignedUrl = await presignGetObject(doc.r2Key, PRESIGN_TTL_SECONDS);
        externalMessageId = await sendDocumentMessage(
          phoneNumberId,
          accessToken,
          input.recipientPhone,
          presignedUrl,
          doc.fileName,
          `📄 ${doc.fileName}`,
        );
        status = DispatchStatus.SENT;
      } catch (err) {
        status = DispatchStatus.FAILED;
        errorDetail =
          err instanceof Error ? err.message : "Unknown dispatch error";
        logger.warn("[whatsapp] doc dispatch failed", {
          stageTransitionId: input.stageTransitionId,
          errorDetail,
        });
      }

      const dispatch = await prisma.channelDispatch.create({
        data: {
          tenantId: input.tenantId,
          stageTransitionId: input.stageTransitionId,
          clientId: input.clientId,
          channel: "WHATSAPP",
          status,
          externalMessageId,
          recipientPhone: input.recipientPhone,
          documentFileName: doc.fileName,
          documentR2Key: doc.r2Key,
          presignedUrl,
          errorDetail,
          sentAt: status === DispatchStatus.SENT ? new Date() : undefined,
        },
      });
      dispatchIds.push(dispatch.id);

      await auditEventPrismaRepository.recordCanonical({
        tenantId: input.tenantId,
        clientId: input.clientId,
        patientPathwayId: null,
        actorUserId: null,
        eventType:
          status === DispatchStatus.SENT
            ? AuditEventType.WHATSAPP_DISPATCH_SENT
            : AuditEventType.WHATSAPP_DISPATCH_FAILED,
        payload: {
          channelDispatchId: dispatch.id,
          stageTransitionId: input.stageTransitionId,
          documentFileName: doc.fileName,
          ...(errorDetail ? { errorDetail } : {}),
        },
      });
    }

    // --- Send interactive confirmation message ---
    try {
      const msgId = await sendInteractiveButtonMessage(
        phoneNumberId,
        accessToken,
        input.recipientPhone,
        `Você recebeu ${input.documents.length} documento(s) da etapa "${input.stageName}". Por favor, confirme o recebimento.`,
        [
          {
            type: "reply",
            reply: { id: "received", title: "Recebi os documentos" },
          },
          {
            type: "reply",
            reply: { id: "help", title: "Preciso de ajuda" },
          },
        ],
      );

      const confirmDispatch = await prisma.channelDispatch.create({
        data: {
          tenantId: input.tenantId,
          stageTransitionId: input.stageTransitionId,
          clientId: input.clientId,
          channel: "WHATSAPP",
          status: DispatchStatus.SENT,
          externalMessageId: msgId,
          recipientPhone: input.recipientPhone,
          sentAt: new Date(),
        },
      });
      dispatchIds.push(confirmDispatch.id);
    } catch (err) {
      const errorDetail =
        err instanceof Error ? err.message : "Unknown error sending confirmation";
      logger.warn("[whatsapp] confirmation message failed", {
        stageTransitionId: input.stageTransitionId,
        errorDetail,
      });

      const failedDispatch = await prisma.channelDispatch.create({
        data: {
          tenantId: input.tenantId,
          stageTransitionId: input.stageTransitionId,
          clientId: input.clientId,
          channel: "WHATSAPP",
          status: DispatchStatus.FAILED,
          recipientPhone: input.recipientPhone,
          errorDetail,
        },
      });
      dispatchIds.push(failedDispatch.id);
    }

    return { dispatchIds };
  },

  async handleStatusUpdate(update: WhatsAppStatusUpdate): Promise<void> {
    const dispatch = await prisma.channelDispatch.findFirst({
      where: { externalMessageId: update.externalMessageId },
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
      where: { externalMessageId: reply.externalMessageId },
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
