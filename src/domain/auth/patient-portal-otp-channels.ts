export type PortalOtpClientContacts = {
  name: string;
  email: string | null;
  phone: string | null;
  isMinor: boolean;
  guardianEmail: string | null;
  guardianPhone: string | null;
};

export type PortalOtpDelivery = {
  emailReady: boolean;
  wppReady: boolean;
  emailRecipients: string[];
  phoneRecipients: string[];
};

const MIN_PHONE_DIGITS = 10;

/**
 * Para quem enviar o OTP. Menores também notificam o responsável (se diferente do paciente).
 * `canEmail` = tenant tem remetente configurado; `hasWebhook` = canal WhatsApp do OTP configurado.
 */
export function resolvePortalOtpDelivery(
  client: PortalOtpClientContacts,
  channels: { canEmail: boolean; hasWebhook: boolean },
): PortalOtpDelivery {
  const email = client.email?.trim() ?? "";
  const guardianEmail = client.isMinor ? (client.guardianEmail?.trim() ?? "") : "";
  const phoneDigits = client.phone?.replace(/\D/g, "") ?? "";
  const guardianPhoneDigits = client.isMinor
    ? (client.guardianPhone ?? "").replace(/\D/g, "").slice(0, 11)
    : "";

  const guardianEmailDistinct =
    client.isMinor && Boolean(guardianEmail) && guardianEmail.toLowerCase() !== email.toLowerCase();
  const emailReady = channels.canEmail && (Boolean(email) || guardianEmailDistinct);
  const wppReady =
    channels.hasWebhook &&
    (phoneDigits.length >= MIN_PHONE_DIGITS ||
      (client.isMinor && guardianPhoneDigits.length >= MIN_PHONE_DIGITS));

  const emailRecipients: string[] = [];
  if (email) emailRecipients.push(email);
  if (
    guardianEmailDistinct &&
    !emailRecipients.some((x) => x.toLowerCase() === guardianEmail.toLowerCase())
  ) {
    emailRecipients.push(guardianEmail);
  }

  const phoneRecipients: string[] = [];
  if (phoneDigits.length >= MIN_PHONE_DIGITS) phoneRecipients.push(client.phone!.trim());
  if (
    client.isMinor &&
    guardianPhoneDigits.length >= MIN_PHONE_DIGITS &&
    guardianPhoneDigits !== phoneDigits
  ) {
    phoneRecipients.push(client.guardianPhone!.trim());
  }

  return { emailReady, wppReady, emailRecipients, phoneRecipients };
}
