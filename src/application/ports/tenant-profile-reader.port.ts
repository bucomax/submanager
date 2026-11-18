export interface ITenantProfileReader {
  findNameAndSlug(tenantId: string): Promise<{ name: string; slug: string } | null>;
}
