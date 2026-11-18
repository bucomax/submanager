export interface IClientVisibilityLookup {
  findClientAssigneeSummary(
    tenantId: string,
    clientId: string,
  ): Promise<{ id: string; assignedToUserId: string | null; opmeSupplierId: string | null } | null>;
}
