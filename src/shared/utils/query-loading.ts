type QueryLoadingState = {
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  isPlaceholderData?: boolean;
};

/**
 * "Mostrar skeleton/spinner": carga inicial, troca de filtro (dado anterior é só placeholder)
 * ou retry após erro. Refetch em segundo plano (reconexão, invalidação) não conta — evita
 * desmontar formulários e perder edição em andamento.
 */
export function isQueryLoading(query: QueryLoadingState): boolean {
  return query.isPending || Boolean(query.isPlaceholderData) || (query.isError && query.isFetching);
}
