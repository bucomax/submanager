import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      globalRole: string;
      /** Tenant ativo (persistido em `User.activeTenantId`). */
      tenantId?: string | null;
      /** Papel no tenant ativo; `null` se super_admin sem membership neste tenant. */
      tenantRole?: string | null;
      /** Nome do tenant ativo (para UI; não substitui checagem de membership no servidor). */
      tenantName?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    globalRole?: string;
    /** Conta desativada (soft delete) — sessão deve ser tratada como inválida. */
    invalid?: boolean;
    /** `User.sessionVersion` no momento do login — divergência invalida a sessão. */
    sv?: number;
  }
}
