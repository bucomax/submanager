/** Portas SMTP permitidas para SMTP por tenant (evita varredura de portas internas). */
export const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525] as const;

export function isAllowedSmtpPort(port: number): boolean {
  return (ALLOWED_SMTP_PORTS as readonly number[]).includes(port);
}
