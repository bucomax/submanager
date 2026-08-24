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

/** Chaves em um lugar só: o clear precisa zerar exatamente o que o apply escreve. */
const CONTEXT_TAG_KEYS = ["tenant.id", "tenant.role", "global.role", "locale"] as const;

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
  // Sem zerar as tags, um evento capturado depois do logout — na tela de login ou
  // no portal do paciente na mesma aba — sairia carimbado com o tenant anterior.
  // Atribuir erro ao tenant errado é pior que não atribuir.
  for (const key of CONTEXT_TAG_KEYS) {
    Sentry.setTag(key, undefined);
  }
}
