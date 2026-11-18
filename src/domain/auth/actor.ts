/** Quem executa o caso de uso (derivado da sessão na borda HTTP; a application não conhece next-auth). */
export type Actor = {
  userId: string;
  globalRole: string;
  /** Tenant ativo do token (`null` se ainda não escolhido). */
  tenantId: string | null;
  /** Papel no tenant ativo; `null` se super_admin sem membership. */
  tenantRole: string | null;
};

export function isSuperAdminActor(actor: Pick<Actor, "globalRole">): boolean {
  return actor.globalRole === "super_admin";
}
