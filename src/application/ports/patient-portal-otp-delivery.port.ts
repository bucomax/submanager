/** Canais de entrega do código OTP do portal (e-mail do tenant e/ou webhook de WhatsApp). */
export interface IPortalOtpDelivery {
  /** O tenant tem remetente de e-mail utilizável. */
  canSendEmail(tenantId: string): Promise<boolean>;
  isWhatsAppWebhookConfigured(): boolean;
  /** Falhas de envio são logadas pela implementação; não propagam (resposta é opaca de qualquer forma). */
  sendEmailCode(input: {
    tenantId: string;
    recipients: string[];
    patientName: string;
    clinicName: string;
    code: string;
  }): Promise<void>;
  sendWhatsAppCode(input: { phones: string[]; clinicName: string; code: string }): Promise<void>;
}
