import { logger } from "@/lib/observability/logger";
import type { Actor } from "@/domain/auth/actor";
import type { z } from "zod";

import type { INotificationEmitter } from "@/application/ports/notification-emitter.port";
import type { INotificationTargetResolver } from "@/application/ports/notification-target-resolver.port";
import type {
  CreatedPatientPathwayRow,
  IPatientPathwayStartStore,
} from "@/application/ports/patient-pathway-start.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import type { IVisibleClientFinder } from "@/application/ports/visible-client-finder.port";
import type { IWhatsAppDispatchQueue } from "@/application/ports/dispatch-queues.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";
import { stageAssigneeCandidates } from "@/domain/pathway/stage-assignee";
import type { StageDocumentBundleItem } from "@/domain/pathway/stage-document-bundle";
import { buildStageDispatchStub } from "@/application/use-cases/pathway/build-stage-dispatch";
import type { postPatientPathwayBodySchema } from "@/lib/validators/pathway";

export type CreatePatientPathwayBody = z.infer<typeof postPatientPathwayBodySchema>;

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

export type CreatePatientPathwayResult =
  | { ok: true; data: CreatePatientPathwaySuccess; afterCommit: () => Promise<void> }
  | { ok: false; code: CreatePatientPathwayErrorCode };

export type CreatePatientPathwayDeps = {
  store: IPatientPathwayStartStore;
  clients: IVisibleClientFinder;
  cache: ITenantListCache;
  notificationTargets: INotificationTargetResolver;
  notifications: INotificationEmitter;
  whatsappQueue: IWhatsAppDispatchQueue;
};

export type CreatePatientPathwayParams = {
  tenantId: string;
  actorUserId: string;
  actor: Actor;
  clientId: string;
  pathwayId: string;
};

type TxResult =
  | { outcome: "active_pathway_exists" }
  | { outcome: "no_published_version" }
  | {
      outcome: "created";
      pp: CreatedPatientPathwayRow;
      transitionId: string;
      documents: StageDocumentBundleItem[];
    };

/**
 * Inicia jornada (`PatientPathway`) para um cliente: transação, notificação, WhatsApp, audit, revalidate cache.
 */
export async function createPatientPathway(
  params: CreatePatientPathwayParams,
  deps: CreatePatientPathwayDeps,
): Promise<CreatePatientPathwayResult> {
  const { tenantId, actorUserId, actor, clientId, pathwayId } = params;
  const { store } = deps;

  const client = await deps.clients.findVisibleClient(actor, tenantId, clientId);
  if (!client) {
    return { ok: false, code: "CLIENT_NOT_FOUND" };
  }

  // Checagem rápida fora da tx; a garantia real (lock + re-check) está dentro da transação.
  if (await store.findActivePatientPathwayId(clientId)) {
    return { ok: false, code: "ACTIVE_PATHWAY_EXISTS" };
  }

  if (!(await store.findCarePathwayId(tenantId, pathwayId))) {
    return { ok: false, code: "PATHWAY_NOT_FOUND" };
  }

  const txResult = await store.runInTransaction(async (tx): Promise<TxResult> => {
    await tx.lockClient(clientId);
    if (await tx.hasActivePatientPathway(clientId)) return { outcome: "active_pathway_exists" };

    // Versão publicada lida SÓ aqui, após o lock da jornada (mesma chave do publish): um publish
    // concorrente já terminou (ou espera), então o paciente nunca nasce numa versão despublicada.
    await tx.lockPathway(pathwayId);
    const publishedVersion = await tx.findPublishedVersionWithFirstStage(pathwayId);
    const firstStage = publishedVersion?.stages[0];
    if (!publishedVersion || !firstStage) return { outcome: "no_published_version" };

    const currentStageAssigneeUserId = await tx.pickFirstTenantMember(
      tenantId,
      stageAssigneeCandidates(firstStage, client.assignedToUserId),
    );
    const pp = await tx.createPatientPathway({
      tenantId,
      clientId,
      pathwayId,
      pathwayVersionId: publishedVersion.id,
      currentStageId: firstStage.id,
      enteredStageAt: new Date(),
      currentStageAssigneeUserId,
    });
    const documents = await tx.getStageDocumentBundle(firstStage.id);

    const createdTransition = await tx.createInitialTransition({
      patientPathwayId: pp.id,
      toStageId: firstStage.id,
      actorUserId,
      dispatchStub: buildStageDispatchStub({
        tenantId,
        clientId,
        stageId: firstStage.id,
        stageName: firstStage.name,
        documents,
      }),
    });

    await tx.audit.record({
      tenantId,
      clientId,
      patientPathwayId: pp.id,
      actorUserId,
      type: AuditEventType.PATIENT_PATHWAY_STARTED,
      payload: { patientPathwayId: pp.id, pathwayId },
    });

    return { outcome: "created", pp, transitionId: createdTransition.id, documents };
  });
  if (txResult.outcome === "active_pathway_exists") {
    return { ok: false, code: "ACTIVE_PATHWAY_EXISTS" };
  }
  if (txResult.outcome === "no_published_version") {
    return { ok: false, code: "NO_PUBLISHED_VERSION" };
  }

  const { pp: result, transitionId, documents } = txResult;

  deps.cache.revalidateClientsList(tenantId);

  /** Notificação + WhatsApp pós-commit; a rota agenda com `after()` (sobrevive em serverless). */
  const afterCommit = async () => {
    const newPatientTargets = await deps.notificationTargets.resolveForPathway({
      tenantId,
      type: "new_patient",
      currentStageAssigneeUserId: result.currentStageAssigneeUserId,
    });

    await deps.notifications
      .emit({
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
      })
      .catch((err) => logger.error("[notification] new_patient emit failed", { err }));

    if (documents.length > 0 && result.client.phone) {
      await deps.whatsappQueue
        .enqueue({
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
        })
        .catch((err) => logger.error("[whatsapp] dispatch enqueue failed", { err }));
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
