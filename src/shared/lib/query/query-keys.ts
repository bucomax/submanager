/**
 * Convenção de query keys: `[domínio, recurso, ...params]`.
 *
 * - Sempre tuplas `as const`, montadas por factory do domínio (nunca string solta no componente).
 * - Params de filtro/paginação entram como objeto no final: `["clients", "list", { q, page }]`.
 * - Invalidação por prefixo: `queryClient.invalidateQueries({ queryKey: clientKeys.all })`.
 * - Cache é limpo na troca de tenant (`clearQueryCache`), então o tenantId não precisa estar na key.
 *
 * Cada feature declara suas keys em `src/features/<nome>/app/hooks/query-keys.ts` usando `defineKeys`.
 */
export function defineKeys<const Domain extends string>(domain: Domain) {
  return {
    all: [domain] as const,
    scope<const S extends readonly unknown[]>(...parts: S) {
      return [domain, ...parts] as const;
    },
  };
}
