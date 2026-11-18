import type { Actor } from "@/domain/auth/actor";

import {
  findTenantClientVisibleToActor,
  loadConversationVisibilityWhere,
} from "@/application/use-cases/shared/load-client-visibility-scope";
import { conversationPrismaRepository } from "@/infrastructure/repositories/conversation.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";

export type AgendaEventRefsError =
  | "conversation_not_found"
  | "patient_not_found"
  | "invalid_assignee";

/**
 * Garante que conversa, paciente e responsável pertencem ao tenant ativo e que conversa/paciente
 * estão no escopo de visibilidade do usuário. Retorna `null` quando tudo é válido.
 */
export async function validateAgendaEventRefs(
  actor: Actor,
  tenantId: string,
  refs: { conversationId?: string | null; clientId?: string | null; ownerUserId?: string },
): Promise<AgendaEventRefsError | null> {
  if (refs.conversationId) {
    const visibility = await loadConversationVisibilityWhere(actor, tenantId);
    const exists = await conversationPrismaRepository.existsInTenant(tenantId, refs.conversationId, visibility);
    if (!exists) return "conversation_not_found";
  }
  if (refs.clientId) {
    const client = await findTenantClientVisibleToActor(actor, tenantId, refs.clientId, { id: true });
    if (!client) return "patient_not_found";
  }
  if (refs.ownerUserId) {
    const owner = await userPrismaRepository.findById(tenantId, refs.ownerUserId);
    if (!owner) return "invalid_assignee";
  }
  return null;
}
