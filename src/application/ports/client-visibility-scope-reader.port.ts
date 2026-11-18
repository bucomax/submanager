import type { TenantMembershipClientScope } from "@/domain/client/client-visibility";

export interface IClientVisibilityScopeReader {
  /** Escopo de pacientes do usuário no tenant (super_admin = admin; sem membership = mais restrito). */
  loadScope(userId: string, tenantId: string, globalRole: string): Promise<TenantMembershipClientScope>;
}
