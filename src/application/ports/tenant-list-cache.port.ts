/** Invalidação de caches de listagem por tenant (efeito colateral pós-escrita). */
export interface ITenantListCache {
  revalidateClientsList(tenantId: string): void;
  revalidatePathwaysAndClientsLists(tenantId: string): void;
  revalidateOpmeSuppliersList(tenantId: string): void;
}
