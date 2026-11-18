import { opmeSupplierPrismaRepository } from "@/infrastructure/repositories/opme-supplier.repository";
import { userPrismaRepository } from "@/infrastructure/repositories/user.repository";

export type ClientReferenceError = "INVALID_ASSIGNEE" | "INVALID_OPME_SUPPLIER";

/** Retorna o primeiro erro de referência inválida (ou `null` se tudo válido). */
export async function validateClientOptionalRefs(
  tenantId: string,
  refs: { assignedToUserId?: string | null; opmeSupplierId?: string | null },
): Promise<ClientReferenceError | null> {
  if (refs.assignedToUserId) {
    const u = await userPrismaRepository.findById(tenantId, refs.assignedToUserId);
    if (!u) return "INVALID_ASSIGNEE";
  }
  if (refs.opmeSupplierId) {
    const s = await opmeSupplierPrismaRepository.findById(tenantId, refs.opmeSupplierId);
    const row = s as { active?: boolean } | null;
    if (!row || row.active === false) return "INVALID_OPME_SUPPLIER";
  }
  return null;
}
