import { logger } from "@/lib/observability/logger";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";
import { isQueueConsumerAvailable, tripRedisCircuit } from "@/infrastructure/queue/redis-connection";

/**
 * Enfileira envio de e-mail (BullMQ) ou processa inline se Redis indisponível.
 */
export async function enqueueEmailDispatch(
  payload: EmailDispatchJobPayload,
  options?: { jobId?: string },
): Promise<void> {
  if (!(await canSendEmailForTenant(payload.tenantId))) return;

  if (payload.kind === "stage_transition_patient" && !payload.to.trim()) {
    return;
  }
  if (
    (payload.kind === "sla_alert" ||
      payload.kind === "file_pending_review_staff" ||
      payload.kind === "checklist_complete_staff") &&
    payload.data.targetUserIds.length === 0
  ) {
    return;
  }

  if (isQueueConsumerAvailable()) {
    try {
      const { getEmailDispatchQueue } = await import("@/infrastructure/queue/email-dispatch-queue");
      const queue = getEmailDispatchQueue();
      if (queue) {
        const jobId =
          options?.jobId ??
          `email|${payload.kind}|${payload.tenantId}`.replace(/:/g, "_");
        await queue.add("send", payload, { jobId });
        return;
      }
    } catch (e) {
      logger.warn("[email] fila Redis indisponível; enviando inline.", { err: e });
      tripRedisCircuit();
    }
  }

  const { processEmailDispatchJob } = await import("@/infrastructure/email/email-dispatch-processor");
  await processEmailDispatchJob(payload);
}
