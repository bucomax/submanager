/** Máscaras de contato para e-mails à equipe (LGPD: mostrar o suficiente para reconhecer, não o dado inteiro). */

/** "helena.prado@gmail.com" → "h***@gmail.com". */
export function maskEmail(email: string): string {
  const [user, domain] = email.trim().split("@");
  if (!user || !domain) return "***";
  return `${user[0]}***@${domain}`;
}

/** "+55 62 99876-4410" → "****-4410" (só os 4 últimos dígitos). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `****-${digits.slice(-4)}`;
}
