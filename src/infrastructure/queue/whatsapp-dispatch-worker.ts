import { logger } from "@/lib/observability/logger";
import { Worker } from "bullmq";

import { getWorkerRedisConnection } from "./redis-connection";
import { WHATSAPP_DISPATCH_QUEUE_NAME } from "./constants";
import type { WhatsAppDispatchJobPayload } from "./whatsapp-dispatch-job-types";
import { whatsappDispatcher } from "@/infrastructure/whatsapp/whatsapp-dispatcher";

let workerInstance: Worker | null = null;

export function startWhatsAppDispatchWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  const connection = getWorkerRedisConnection();
  if (!connection) {
    logger.warn("[whatsapp-worker] Redis not available – worker not started.");
    return null;
  }

  workerInstance = new Worker(
    WHATSAPP_DISPATCH_QUEUE_NAME,
    async (job) => {
      const payload = job.data as WhatsAppDispatchJobPayload;
      await whatsappDispatcher.dispatch({
        tenantId: payload.tenantId,
        stageTransitionId: payload.stageTransitionId,
        clientId: payload.clientId,
        recipientPhone: payload.recipientPhone,
        stageName: payload.stageName,
        documents: payload.documents,
      });
    },
    {
      connection,
      concurrency: 3,
    },
  );

  workerInstance.on("failed", (job, err) => {
    const payload = job?.data as WhatsAppDispatchJobPayload | undefined;
    logger.error("[whatsapp-worker] job failed", {
      jobId: job?.id,
      tenantId: payload?.tenantId,
      stageTransitionId: payload?.stageTransitionId,
      err,
    });
  });

  return workerInstance;
}
