import type { Session } from "next-auth";

import type { Actor } from "@/domain/auth/actor";

/** Adapter sessão → `Actor` (único ponto que traduz next-auth para a application). */
export function actorFromSession(session: Session): Actor {
  return {
    userId: session.user.id,
    globalRole: session.user.globalRole,
    tenantId: session.user.tenantId ?? null,
    tenantRole: session.user.tenantRole ?? null,
  };
}
