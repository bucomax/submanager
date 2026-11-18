import { logger } from "@/lib/observability/logger";
import { Worker } from "bullmq";

import { getWorkerRedisConnection } from "./redis-connection";
import { EMAIL_DISPATCH_QUEUE_NAME } from "./constants";
import type { EmailDispatchJobPayload } from "./email-dispatch-job-types";
import { processEmailDispatchJob } from "@/infrastructure/email/email-dispatch-processor";

let workerInstance: Worker | null = null;

export function startEmailDispatchWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  const connection = getWorkerRedisConnection();
  if (!connection) {
    logger.warn("[email-worker] Redis not available – worker not started.");
    return null;
  }

  workerInstance = new Worker(
    EMAIL_DISPATCH_QUEUE_NAME,
    async (job) => {
      const payload = job.data as EmailDispatchJobPayload;
      await processEmailDispatchJob(payload);
    },
    {
      connection,
      concurrency: 2,
    },
  );

  workerInstance.on("failed", (job, err) => {
    const p = job?.data as EmailDispatchJobPayload | undefined;
    logger.error("[email-worker] job failed", {
      jobId: job?.id,
      kind: p?.kind,
      tenantId: p?.tenantId,
      err,
    });
  });

  return workerInstance;
}
