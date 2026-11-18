import { logger } from "@/lib/observability/logger";
import { Worker } from "bullmq";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/infrastructure/database/prisma";
import { getRedisConnection, getWorkerRedisConnection } from "./redis-connection";
import { NOTIFICATION_QUEUE_NAME, SSE_NOTIFICATIONS_CHANNEL } from "./constants";
import type { NotificationJobPayload } from "./notification-job-types";

async function processNotificationJob(payload: NotificationJobPayload): Promise<void> {
  const metadataJson = payload.metadata
    ? (JSON.parse(JSON.stringify(payload.metadata)) as Prisma.InputJsonValue)
    : undefined;

  const created = await prisma.notification.createManyAndReturn({
    data: payload.userIds.map((userId) => ({
      tenantId: payload.tenantId,
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      metadata: metadataJson,
    })),
    select: {
      id: true,
      userId: true,
      tenantId: true,
      type: true,
      title: true,
      body: true,
      metadata: true,
      readAt: true,
      createdAt: true,
    },
  });

  const redis = getRedisConnection();
  if (!redis) return;

  for (const n of created) {
    const ssePayload = JSON.stringify({
      userId: n.userId,
      tenantId: n.tenantId,
      notification: {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        metadata: n.metadata,
        readAt: null,
        createdAt: n.createdAt.toISOString(),
      },
    });
    await redis.publish(SSE_NOTIFICATIONS_CHANNEL, ssePayload);
  }
}

let workerInstance: Worker | null = null;

export function startNotificationWorker(): Worker | null {
  if (workerInstance) return workerInstance;

  const connection = getWorkerRedisConnection();
  if (!connection) {
    logger.warn("[notification-worker] Redis not available – worker not started.");
    return null;
  }

  workerInstance = new Worker(
    NOTIFICATION_QUEUE_NAME,
    async (job) => {
      await processNotificationJob(job.data as NotificationJobPayload);
    },
    {
      connection,
      concurrency: 5,
    },
  );

  workerInstance.on("failed", (job, err) => {
    const payload = job?.data as NotificationJobPayload | undefined;
    logger.error("[notification-worker] job failed", {
      jobId: job?.id,
      tenantId: payload?.tenantId,
      type: payload?.type,
      err,
    });
  });

  return workerInstance;
}
