import * as Sentry from "@sentry/nextjs";

/**
 * Só o id do usuário vai para o Sentry. Nome e e-mail identificam pessoa e não
 * agregam nada ao diagnóstico — o id resolve qualquer investigação pelo banco.
 */
export type SentryUserContext = {
  userId: string;
  tenantId: string | null;
  tenantRole: string | null;
  globalRole: string | null;
  locale: string;
};

export function applySentryUserContext(context: SentryUserContext): void {
  Sentry.setUser({ id: context.userId });
  Sentry.setTags({
    "tenant.id": context.tenantId ?? "none",
    "tenant.role": context.tenantRole ?? "none",
    "global.role": context.globalRole ?? "none",
    locale: context.locale,
  });
}

export function clearSentryUserContext(): void {
  Sentry.setUser(null);
}
