import { z } from "zod";
import { type Prisma } from "@prisma/client";

import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { IClientRepository } from "@/application/ports/client-repository.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";
import { mapPrismaClientRowToClientDto } from "@/application/use-cases/client/serialize-client-list";
import { digitsOnlyCpf } from "@/lib/validators/cpf";
import type { patchClientBodySchema } from "@/lib/validators/client";
import type { ClientDto } from "@/types/api/clients-v1";

export type UpdateClientBody = z.infer<typeof patchClientBodySchema>;

export type UpdateClientPatchResult =
  | { ok: true; client: ClientDto }
  | { ok: false; code: "NO_FIELDS_TO_UPDATE" };

export type UpdateClientDeps = {
  clients: Pick<IClientRepository, "updateClientStaff">;
  audit: IAuditRecorder;
  cache: Pick<ITenantListCache, "revalidateClientsList" | "revalidateOpmeSuppliersList">;
};

/**
 * Atualiza paciente (PATCH): monta `data`, persiste, revalida caches, auditoria.
 */
export async function updateClient(
  params: { tenantId: string; actorUserId: string; clientDbId: string; patch: UpdateClientBody },
  deps: UpdateClientDeps,
): Promise<UpdateClientPatchResult> {
  const { tenantId, actorUserId, clientDbId, patch: p } = params;

  const data: Prisma.ClientUncheckedUpdateInput = {};
  if (p.name !== undefined) data.name = p.name.trim();
  if (p.phone !== undefined) data.phone = p.phone.trim();
  if (p.email !== undefined) data.email = p.email;
  if (p.caseDescription !== undefined) {
    data.caseDescription = p.caseDescription === null ? null : p.caseDescription.trim() || null;
  }
  if (p.documentId !== undefined) {
    data.documentId = p.documentId === null ? null : digitsOnlyCpf(p.documentId);
  }
  if (p.assignedToUserId !== undefined) data.assignedToUserId = p.assignedToUserId;
  if (p.opmeSupplierId !== undefined) data.opmeSupplierId = p.opmeSupplierId;
  if (p.postalCode !== undefined) data.postalCode = p.postalCode;
  if (p.addressLine !== undefined) data.addressLine = p.addressLine;
  if (p.addressNumber !== undefined) data.addressNumber = p.addressNumber;
  if (p.addressComp !== undefined) data.addressComp = p.addressComp;
  if (p.neighborhood !== undefined) data.neighborhood = p.neighborhood;
  if (p.city !== undefined) data.city = p.city;
  if (p.state !== undefined) data.state = p.state;
  if (p.isMinor !== undefined) data.isMinor = p.isMinor;
  if (p.guardianName !== undefined) data.guardianName = p.guardianName;
  if (p.guardianDocumentId !== undefined) {
    data.guardianDocumentId =
      p.guardianDocumentId === null ? null : digitsOnlyCpf(p.guardianDocumentId);
  }
  if (p.guardianPhone !== undefined) data.guardianPhone = p.guardianPhone;
  if (p.guardianEmail !== undefined) data.guardianEmail = p.guardianEmail;
  if (p.guardianRelationship !== undefined) data.guardianRelationship = p.guardianRelationship;
  if (p.emergencyContactName !== undefined) data.emergencyContactName = p.emergencyContactName;
  if (p.emergencyContactPhone !== undefined) data.emergencyContactPhone = p.emergencyContactPhone;
  if (p.preferredChannel !== undefined) data.preferredChannel = p.preferredChannel;
  if (p.birthDate !== undefined) {
    if (p.birthDate === null) {
      data.birthDate = null;
    } else {
      const d = new Date(`${p.birthDate}T12:00:00.000Z`);
      data.birthDate = Number.isFinite(d.getTime()) ? d : null;
    }
  }

  if (p.isMinor === false) {
    data.guardianName = null;
    data.guardianDocumentId = null;
    data.guardianPhone = null;
    data.guardianEmail = null;
    data.guardianRelationship = null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, code: "NO_FIELDS_TO_UPDATE" };
  }

  const opmeChanged = p.opmeSupplierId !== undefined;
  const row = await deps.clients.updateClientStaff(tenantId, clientDbId, data);

  deps.cache.revalidateClientsList(tenantId);
  if (opmeChanged) {
    deps.cache.revalidateOpmeSuppliersList(tenantId);
  }

  const changedFields = Object.keys(data).filter((k) => k !== "updatedAt");
  await deps.audit.record({
    tenantId,
    clientId: clientDbId,
    patientPathwayId: null,
    actorUserId,
    type: AuditEventType.PATIENT_UPDATED,
    payload: { clientId: clientDbId, changedFields },
  });

  return { ok: true, client: mapPrismaClientRowToClientDto(row as Parameters<typeof mapPrismaClientRowToClientDto>[0]) };
}
