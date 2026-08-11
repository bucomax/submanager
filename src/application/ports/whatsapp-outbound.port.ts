/**
 * Envio de mensagem de texto livre numa Conversation (chat interativo).
 * Distinto de IWhatsAppDispatcher, que só envia documentos vinculados a StageTransition.
 */

export type WhatsAppOutboundInput = {
  tenantId: string;
  recipientPhone: string;
  text: string;
};

export type WhatsAppOutboundResult =
  | { sent: true; externalMessageId: string }
  | {
      sent: false;
      reason: "tenant_not_configured" | "send_failed";
      errorDetail?: string;
    };

export interface IWhatsAppOutbound {
  sendText(input: WhatsAppOutboundInput): Promise<WhatsAppOutboundResult>;
}
