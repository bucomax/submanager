import type {
  IWhatsAppOutbound,
  WhatsAppOutboundInput,
  WhatsAppOutboundResult,
} from "@/application/ports/whatsapp-outbound.port";
import { decryptTenantSecret } from "@/infrastructure/crypto/tenant-secret";
import { prisma } from "@/infrastructure/database/prisma";
import { sendTextMessage } from "@/infrastructure/whatsapp/whatsapp-cloud-client";

/**
 * Envia texto livre via WhatsApp Cloud API reaproveitando as mesmas credenciais
 * (`Tenant.whatsapp*`) já usadas por `whatsappDispatcher` para documentos.
 * Skip gracioso quando o tenant não tem WhatsApp configurado — a mensagem
 * é sempre persistida pelo caller (ver send-conversation-message.ts),
 * este adapter só decide se o envio externo aconteceu.
 */
export const whatsappOutbound: IWhatsAppOutbound = {
  async sendText(input: WhatsAppOutboundInput): Promise<WhatsAppOutboundResult> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: {
        whatsappEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessTokenEnc: true,
      },
    });

    if (
      !tenant?.whatsappEnabled ||
      !tenant.whatsappPhoneNumberId ||
      !tenant.whatsappAccessTokenEnc
    ) {
      return { sent: false, reason: "tenant_not_configured" };
    }

    try {
      const accessToken = decryptTenantSecret(tenant.whatsappAccessTokenEnc);
      const externalMessageId = await sendTextMessage(
        tenant.whatsappPhoneNumberId,
        accessToken,
        input.recipientPhone,
        input.text,
      );
      return { sent: true, externalMessageId };
    } catch (err) {
      return {
        sent: false,
        reason: "send_failed",
        errorDetail: err instanceof Error ? err.message : "Unknown send error",
      };
    }
  },
};
