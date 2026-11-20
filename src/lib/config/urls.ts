/**
 * URL pública da aplicação a partir de um mapa de env (testável sem tocar `process.env`).
 * Prioridade: APP_PUBLIC_URL → NEXTAUTH_URL → localhost.
 */
export function resolvePublicAppUrl(env: Record<string, string | undefined>): string {
  const raw = env.APP_PUBLIC_URL?.trim() || env.NEXTAUTH_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/**
 * URL pública da aplicação (links em e-mails, redirects).
 * Prioridade: APP_PUBLIC_URL → NEXTAUTH_URL → localhost.
 */
export function getPublicAppUrl(): string {
  return resolvePublicAppUrl(process.env);
}
