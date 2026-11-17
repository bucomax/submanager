import type { WhatsAppDispatchInput } from "@/application/ports/whatsapp-dispatcher.port";
import type { WhatsAppDispatchJobPayload } from "@/infrastructure/queue/whatsapp-dispatch-job-types";
import { isQueueConsumerAvailable, tripRedisCircuit } from "@/infrastructure/queue/redis-connection";
import { prisma } from "@/infrastructure/database/prisma";

/**
 * Enqueues a WhatsApp dispatch job (BullMQ) or runs inline if Redis is unavailable.
 * Checks if the tenant has WhatsApp enabled before proceeding.
 */
export async function enqueueWhatsAppDispatch(
  input: WhatsAppDispatchInput,
): Promise<void> {
  // Quick check: is WhatsApp enabled for this tenant?
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { whatsappEnabled: true },
  });
  if (!tenant?.whatsappEnabled) return;

  const payload: WhatsAppDispatchJobPayload = {
    tenantId: input.tenantId,
    stageTransitionId: input.stageTransitionId,
    clientId: input.clientId,
    recipientPhone: input.recipientPhone,
    stageName: input.stageName,
    documents: input.documents,
  };

  // Try BullMQ first
  if (isQueueConsumerAvailable()) {
    try {
      const { getWhatsAppDispatchQueue } = await import(
        "@/infrastructure/queue/whatsapp-dispatch-queue"
      );
      const queue = getWhatsAppDispatchQueue();
      if (queue) {
        const jobId = `wpp|${input.tenantId}|${input.stageTransitionId}`.replace(
          /:/g,
          "_",
        );
        await queue.add("dispatch", payload, { jobId });
        return;
      }
    } catch (e) {
      console.warn(
        "[whatsapp] Redis queue unavailable; dispatching inline.",
        e,
      );
      tripRedisCircuit();
    }
  }

  // Fallback: inline dispatch
  const { whatsappDispatcher } = await import(
    "@/infrastructure/whatsapp/whatsapp-dispatcher"
  );
  await whatsappDispatcher.dispatch(input);
}
