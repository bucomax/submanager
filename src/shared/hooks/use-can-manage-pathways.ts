"use client";

import { useSession } from "next-auth/react";

/**
 * Somente `tenant_admin` e `super_admin` podem alterar fluxos (a API responde 403 para os demais).
 * `isLoading` evita exibir/ocultar controles antes de a sessão carregar.
 */
export function useCanManagePathways(): { canManage: boolean; isLoading: boolean } {
  const { data: session, status } = useSession();
  return {
    canManage:
      session?.user?.globalRole === "super_admin" || session?.user?.tenantRole === "tenant_admin",
    isLoading: status === "loading",
  };
}
