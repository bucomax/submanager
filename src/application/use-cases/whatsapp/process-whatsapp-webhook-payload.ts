import { logger } from "@/lib/observability/logger";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { whatsappDispatcher } from "@/infrastructure/whatsapp/whatsapp-dispatcher";
import type { WhatsappWebhookPayload } from "@/types/api/whatsapp-webhook-v1";

export async function processWhatsappWebhookPayload(payload: WhatsappWebhookPayload): Promise<void> {
  if (payload.object !== "whatsapp_business_account") return;

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const value = change.value;

      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const tenant = await tenantPrismaRepository.findTenantIdByWhatsappPhoneNumberId(phoneNumberId);
      if (!tenant) {
        logger.warn("[whatsapp-webhook] No tenant found for phone_number_id", { phoneNumberId });
        continue;
      }

      for (const status of value.statuses ?? []) {
        await whatsappDispatcher.handleStatusUpdate({
          tenantId: tenant.id,
          externalMessageId: status.id,
          status: status.status as "sent" | "delivered" | "read" | "failed",
          timestamp: status.timestamp,
          errorCode: status.errors?.[0]?.code?.toString(),
          errorTitle: status.errors?.[0]?.title,
        });
      }

      for (const msg of value.messages ?? []) {
        if (
          msg.type === "interactive" &&
          msg.interactive?.type === "button_reply" &&
          msg.interactive.button_reply &&
          msg.context?.id
        ) {
          await whatsappDispatcher.handleButtonReply({
            tenantId: tenant.id,
            externalMessageId: msg.context.id,
            buttonPayload: msg.interactive.button_reply.id,
            timestamp: msg.timestamp,
          });
        }
      }
    }
  }
}
