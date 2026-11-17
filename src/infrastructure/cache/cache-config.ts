/** TTL (segundos) para `unstable_cache` — listagens; trade-off frescor × DB. */
export const CACHE_REVALIDATE_SEC = {
  /** Jornadas do tenant. */
  pathwaysList: 90,
  /** Fornecedores OPME. */
  opmeSuppliersList: 60,
} as const;
