import type { Actor } from "@/domain/auth/actor";

export interface IVisibleClientFinder {
  /** Cliente do tenant visível para a sessão (RBAC de visibilidade); `null` se inexistente ou fora do escopo. */
  findVisibleClient(
    actor: Actor,
    tenantId: string,
    clientId: string,
  ): Promise<{ id: string; assignedToUserId: string | null } | null>;
}
