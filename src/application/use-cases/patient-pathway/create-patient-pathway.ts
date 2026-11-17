import { z } from "zod";

import type { Prisma } from "@prisma/client";
import { revalidateTenantClientsList } from "@/infrastructure/cache/revalidate-tenant-lists";
import { recordAuditEvent, AuditEventType } from "@/infrastructure/audit/record-audit-event";
import { pathwayPrismaRepository } from "@/infrastructure/repositories/pathway.repository";
import { patientPathwayPrismaRepository } from "@/infrastructure/repositories/patient-pathway.repository";
import { notificationEmitter } from "@/infrastructure/notifications/notification-emitter";
import { enqueueWhatsAppDispatch } from "@/infrastructure/whatsapp/whatsapp-dispatch-emitter";
import { buildStageDispatchStub, getStageDocumentBundle } from "@/application/use-cases/pathway/build-stage-dispatch";
import { resolvePathwayNotificationTargetUserIds } from "@/application/use-cases/notification/resolve-notification-targets";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { resolvePatientPathwayStageAssigneeUserId } from "@/application/use-cases/shared/validate-tenant-members";
import { postPatientPathwayBodySchema } from "@/lib/validators/pathway";
import type { Session } from "next-auth";

export type CreatePatientPathwayBody = z.infer<typeof postPatientPathwayBodySchema>;

export { postPatientPathwayBodySchema };

export type CreatePatientPathwayErrorCode =
  | "CLIENT_NOT_FOUND"
  | "ACTIVE_PATHWAY_EXISTS"
  | "PATHWAY_NOT_FOUND"
  | "NO_PUBLISHED_VERSION";

export type CreatePatientPathwaySuccess = {
  patientPathway: {
    id: string;
    client: { id: string; name: string; phone: string };
    pathway: { id: string; name: string };
    currentStage: {
      id: string;
      name: string;
      stageKey: string;
      sortOrder: number;
      patientMessage: string | null;
      alertWarningDays: number | null;
      alertCriticalDays: number | null;
      defaultAssigneeUserId: string | null;
      defaultAssigneeUserIds: string[];
    };
    currentStageAssignee: { id: string; name: string | null; email: string } | null;
    enteredStageAt: string;
    createdAt: string;
  };
};

/**
 * Inicia jornada (`PatientPathway`) para um cliente: transação, notificação, WhatsApp, audit, revalidate cache.
 */
export async function runCreatePatientPathway(params: {
  tenantId: string;
  actorUserId: string;
  session: Session;
  clientId: string;
  pathwayId: string;
}): Promise<
  { ok: true; data: CreatePatientPathwaySuccess; afterCommit: () => Promise<void> } | { ok: false; code: CreatePatientPathwayErrorCode }
> {
  const { tenantId, actorUserId, session, clientId, pathwayId } = params;

  const client = await findTenantClientVisibleToSession(session, tenantId, clientId, {
    id: true,
    assignedToUserId: true,
  });
  if (!client) {
    return { ok: false, code: "CLIENT_NOT_FOUND" };
  }

  // Checagem rápida fora da tx; a garantia real (lock + re-check) está dentro da transação.
  const activePathway = await patientPathwayPrismaRepository.findFirstActivePatientPathwayByClientId(
    clientId,
  );
  if (activePathway) {
    return { ok: false, code: "ACTIVE_PATHWAY_EXISTS" };
  }

  const pathway = await pathwayPrismaRepository.findCarePathwayIdForPublish(tenantId, pathwayId);
  if (!pathway) {
    return { ok: false, code: "PATHWAY_NOT_FOUND" };
  }

  const publishedVersionRaw = await pathwayPrismaRepository.findPublishedVersionWithFirstStage(pathwayId);
  const publishedVersion = publishedVersionRaw as
    | (Prisma.PathwayVersionGetPayload<{
        include: { stages: true };
      }> & { stages: Prisma.PathwayStageGetPayload<object>[] })
    | null;
  if (!publishedVersion || publishedVersion.stages.length === 0) {
    return { ok: false, code: "NO_PUBLISHED_VERSION" };
  }

  const firstStage = publishedVersion.stages[0]!;

  const txResult = await patientPathwayPrismaRepository.runInTransaction(async (txRaw) => {
    const tx = txRaw as Prisma.TransactionClient;
    // Serializa criações concorrentes para o mesmo paciente (duplo clique / retry).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`patient-pathway:${clientId}`}))`;
    const activeInTx = await tx.patientPathway.findFirst({
      where: { clientId, completedAt: null },
      select: { id: true },
    });
    if (activeInTx) return null;
    const now = new Date();
    const currentStageAssigneeUserId = await resolvePatientPathwayStageAssigneeUserId(
      tx,
      tenantId,
      {
        defaultAssigneeUserIds: firstStage.defaultAssigneeUserIds,
        defaultAssigneeUserId: firstStage.defaultAssigneeUserId,
      },
      client.assignedToUserId,
    );
    const pp = await tx.patientPathway.create({
      data: {
        tenantId,
        clientId,
        pathwayId,
        pathwayVersionId: publishedVersion.id,
        currentStageId: firstStage.id,
        enteredStageAt: now,
        currentStageAssigneeUserId,
      },
      include: {
        currentStage: true,
        pathway: { select: { id: true, name: true } },
        client: { select: { id: true, name: true, phone: true } },
        currentStageAssignee: { select: { id: true, name: true, email: true } },
      },
    });
    const documents = await getStageDocumentBundle(tx, firstStage.id);

    const createdTransition = await tx.stageTransition.create({
      data: {
        patientPathwayId: pp.id,
        fromStageId: null,
        toStageId: firstStage.id,
        actorUserId,
        dispatchStub: buildStageDispatchStub({
          tenantId,
          clientId,
          stageId: firstStage.id,
          stageName: firstStage.name,
          documents,
        }),
      },
      select: { id: true },
    });

    await recordAuditEvent(tx, {
      tenantId,
      clientId,
      patientPathwayId: pp.id,
      actorUserId,
      type: AuditEventType.PATIENT_PATHWAY_STARTED,
      payload: { patientPathwayId: pp.id, pathwayId },
    });

    return { pp, transitionId: createdTransition.id, documents };
  });
  if (!txResult) {
    return { ok: false, code: "ACTIVE_PATHWAY_EXISTS" };
  }

  const result = txResult.pp;
  const { transitionId, documents } = txResult;

  revalidateTenantClientsList(tenantId);

  /** Notificação + WhatsApp pós-commit; a rota agenda com `after()` (sobrevive em serverless). */
  const afterCommit = async () => {
    const newPatientTargets = await resolvePathwayNotificationTargetUserIds({
      tenantId,
      type: "new_patient",
      currentStageAssigneeUserId: result.currentStageAssigneeUserId,
    });

    await notificationEmitter.emit({
      tenantId,
      type: "new_patient",
      title: `Novo paciente: ${result.client.name}`,
      body: `Jornada "${result.pathway.name}" iniciada na etapa ${result.currentStage.name}.`,
      targetUserIds: newPatientTargets,
      correlationId: result.id,
      metadata: {
        clientId: result.clientId,
        patientPathwayId: result.id,
        pathwayName: result.pathway.name,
        stageName: result.currentStage.name,
      },
    }).catch((err) => console.error("[notification] new_patient emit failed:", err));

    if (documents.length > 0 && result.client.phone) {
      await enqueueWhatsAppDispatch({
        tenantId,
        stageTransitionId: transitionId,
        clientId: result.clientId,
        recipientPhone: result.client.phone,
        stageName: result.currentStage.name,
        documents: documents.map((d) => ({
          fileName: d.file.fileName,
          r2Key: d.file.r2Key,
          mimeType: d.file.mimeType,
        })),
      }).catch((err) => console.error("[whatsapp] dispatch enqueue failed:", err));
    }
  };

  return {
    ok: true,
    afterCommit,
    data: {
      patientPathway: {
        id: result.id,
        client: result.client,
        pathway: result.pathway,
        currentStage: result.currentStage,
        currentStageAssignee: result.currentStageAssignee
          ? {
              id: result.currentStageAssignee.id,
              name: result.currentStageAssignee.name,
              email: result.currentStageAssignee.email,
            }
          : null,
        enteredStageAt: result.enteredStageAt.toISOString(),
        createdAt: result.createdAt.toISOString(),
      },
    },
  };
}
