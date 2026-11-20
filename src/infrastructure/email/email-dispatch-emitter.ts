import { logger } from "@/lib/observability/logger";
import { releaseDispatchKey, reserveDispatchKey } from "@/infrastructure/database/dispatch-key";
import { canSendEmailForTenant } from "@/infrastructure/email/email-availability";
import { EmailDispatchRetryableError } from "@/infrastructure/email/email-send-error";
import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";
import { isQueueConsumerAvailable, tripRedisCircuit } from "@/infrastructure/queue/redis-connection";

/**
 * Processa o e-mail neste processo (sem Redis ou com a fila indisponível). Com `jobId` determinístico,
 * reserva a chave antes (dedupe que o BullMQ daria pela fila); sem fila não há retry automático.
 */
async function processInline(payload: EmailDispatchJobPayload, jobId: string | undefined): Promise<void> {
  const reservationKey = jobId ? `email-job|${jobId}` : null;
  if (reservationKey && !(await reserveDispatchKey(reservationKey))) {
    logger.debug("[email] job already dispatched; skipping", { tenantId: payload.tenantId, kind: payload.kind, jobId });
    return;
  }

  const { processEmailDispatchJob } = await import("@/infrastructure/email/email-dispatch-processor");
  try {
    await processEmailDispatchJob(payload);
  } catch (err) {
    // Falha antes de concluir o envio: libera a reserva para uma nova execução (ex.: reexecução do cron).
    if (reservationKey) await releaseDispatchKey(reservationKey).catch(() => undefined);
    if (err instanceof EmailDispatchRetryableError) {
      logger.error("[email] inline dispatch failed (no queue, no automatic retry)", {
        tenantId: payload.tenantId,
        kind: payload.kind,
        jobId,
        failures: err.failures,
        err,
      });
      return;
    }
    throw err;
  }
}

/**
 * Enfileira envio de e-mail (BullMQ) ou processa inline se Redis indisponível.
 * `options.jobId` deve ser determinístico por evento: dedupa na fila e, sem fila, via `DispatchKey`.
 * Sem `jobId` não há dedupe (cada chamada envia).
 */
export async function enqueueEmailDispatch(
  payload: EmailDispatchJobPayload,
  options?: { jobId?: string },
): Promise<void> {
  if (!(await canSendEmailForTenant(payload.tenantId))) return;

  if (payload.kind === "stage_transition_patient" && !payload.to.trim()) {
    return;
  }
  if (payload.kind !== "stage_transition_patient" && payload.data.targetUserIds.length === 0) {
    return;
  }

  if (isQueueConsumerAvailable()) {
    try {
      const { getEmailDispatchQueue } = await import("@/infrastructure/queue/email-dispatch-queue");
      const queue = getEmailDispatchQueue();
      if (queue) {
        await queue.add("send", payload, options?.jobId ? { jobId: options.jobId } : undefined);
        return;
      }
    } catch (e) {
      logger.warn("[email] fila Redis indisponível; enviando inline.", { err: e });
      tripRedisCircuit();
    }
  }

  await processInline(payload, options?.jobId);
}
