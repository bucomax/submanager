import { logger } from "@/lib/observability/logger";
import { AuditEventType, DispatchStatus } from "@prisma/client";

import type {
  WhatsAppDispatchDocument,
  WhatsAppDispatchInput,
} from "@/application/ports/whatsapp-dispatcher.port";
import { prisma } from "@/infrastructure/database/prisma";
import { auditEventPrismaRepository } from "@/infrastructure/repositories/audit-event.repository";
import { presignGetObject } from "@/infrastructure/storage/gcs-storage";
import {
  sendDocumentMessage,
  sendInteractiveButtonMessage,
} from "@/infrastructure/whatsapp/whatsapp-cloud-client";

/** Presigned URL TTL for documents sent via WhatsApp (30 minutes). */
const PRESIGN_TTL_SECONDS = 30 * 60;

/** Status em que a Meta aceitou a mensagem (o webhook de status só avança a partir de SENT). */
const ACCEPTED_STATUSES: DispatchStatus[] = [
  DispatchStatus.SENT,
  DispatchStatus.DELIVERED,
  DispatchStatus.READ,
  DispatchStatus.CONFIRMED,
];

export type SendContext = {
  input: WhatsAppDispatchInput;
  phoneNumberId: string;
  accessToken: string;
};

/**
 * O que já saiu para esta transição, para um retry (job reprocessado, worker reiniciado) não reenviar:
 * `r2Key` dos documentos aceitos pela Meta e se a mensagem-resumo (sem documento) já foi enviada.
 */
export async function loadAlreadySent(input: WhatsAppDispatchInput): Promise<{
  documentKeys: Set<string>;
  summarySent: boolean;
}> {
  const rows = await prisma.channelDispatch.findMany({
    where: {
      tenantId: input.tenantId,
      stageTransitionId: input.stageTransitionId,
      channel: "WHATSAPP",
      status: { in: ACCEPTED_STATUSES },
    },
    select: { documentR2Key: true },
  });
  return {
    documentKeys: new Set(rows.flatMap((r) => (r.documentR2Key ? [r.documentR2Key] : []))),
    summarySent: rows.some((r) => r.documentR2Key === null),
  };
}

/** Envia um documento e registra `ChannelDispatch` + audit. `delivered` = a Meta aceitou o envio. */
export async function sendDocument(
  ctx: SendContext,
  doc: WhatsAppDispatchDocument,
): Promise<{ dispatchId: string; delivered: boolean }> {
  const { input } = ctx;
  let presignedUrl: string | undefined;
  let externalMessageId: string | undefined;
  let errorDetail: string | undefined;
  let status: DispatchStatus = DispatchStatus.QUEUED;

  try {
    presignedUrl = await presignGetObject(doc.r2Key, PRESIGN_TTL_SECONDS);
    externalMessageId = await sendDocumentMessage(
      ctx.phoneNumberId,
      ctx.accessToken,
      input.recipientPhone,
      presignedUrl,
      doc.fileName,
      `📄 ${doc.fileName}`,
    );
    status = DispatchStatus.SENT;
  } catch (err) {
    status = DispatchStatus.FAILED;
    errorDetail = err instanceof Error ? err.message : "Unknown dispatch error";
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
  return { dispatchId: dispatch.id, delivered: status === DispatchStatus.SENT };
}

/** Mensagem-resumo com botões de confirmação; `deliveredCount` = documentos que realmente saíram. */
export async function sendConfirmationMessage(ctx: SendContext, deliveredCount: number): Promise<string> {
  const { input } = ctx;
  const base = {
    tenantId: input.tenantId,
    stageTransitionId: input.stageTransitionId,
    clientId: input.clientId,
    channel: "WHATSAPP" as const,
    recipientPhone: input.recipientPhone,
  };
  try {
    const msgId = await sendInteractiveButtonMessage(
      ctx.phoneNumberId,
      ctx.accessToken,
      input.recipientPhone,
      `Você recebeu ${deliveredCount} documento(s) da etapa "${input.stageName}". Por favor, confirme o recebimento.`,
      [
        { type: "reply", reply: { id: "received", title: "Recebi os documentos" } },
        { type: "reply", reply: { id: "help", title: "Preciso de ajuda" } },
      ],
    );
    const sent = await prisma.channelDispatch.create({
      data: { ...base, status: DispatchStatus.SENT, externalMessageId: msgId, sentAt: new Date() },
    });
    return sent.id;
  } catch (err) {
    const errorDetail = err instanceof Error ? err.message : "Unknown error sending confirmation";
    logger.warn("[whatsapp] confirmation message failed", {
      stageTransitionId: input.stageTransitionId,
      errorDetail,
    });
    const failed = await prisma.channelDispatch.create({
      data: { ...base, status: DispatchStatus.FAILED, errorDetail },
    });
    return failed.id;
  }
}
