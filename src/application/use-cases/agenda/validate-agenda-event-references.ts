import type { Session } from "next-auth";

import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";
import type { ApiT } from "@/lib/api/i18n";
import { jsonError } from "@/lib/api-response";

/** Garante que conversa, paciente (no escopo do usuário) e responsável pertencem ao tenant ativo. */
export async function validateAgendaEventRefs(
  session: Session,
  tenantId: string,
  refs: { conversationId?: string | null; clientId?: string | null; ownerUserId?: string },
  apiT: ApiT,
): Promise<Response | null> {
  if (refs.conversationId) {
    const exists = await conversationPrismaRepository.existsInTenant(tenantId, refs.conversationId);
    if (!exists) {
      return jsonError("NOT_FOUND", apiT("errors.conversationNotFound"), 404);
    }
  }
  if (refs.clientId) {
    const client = await findTenantClientVisibleToSession(session, tenantId, refs.clientId, { id: true });
    if (!client) {
      return jsonError("NOT_FOUND", apiT("errors.patientNotFoundInTenant"), 404);
    }
  }
  if (refs.ownerUserId) {
    const owner = await userPrismaRepository.findById(tenantId, refs.ownerUserId);
    if (!owner) {
      return jsonError("VALIDATION_ERROR", apiT("errors.invalidAssigneeForTenant"), 422);
    }
  }
  return null;
}
