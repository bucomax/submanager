import { z } from "zod";

import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { IClientRepository } from "@/application/ports/client-repository.port";
import type { ITenantListCache } from "@/application/ports/tenant-list-cache.port";
import { AuditEventType } from "@/domain/audit/audit-event-type";
import { mapPrismaClientRowToClientDto } from "@/application/use-cases/client/serialize-client-list";
import type { postClientBodySchema } from "@/lib/validators/client";
import type { ClientDto } from "@/types/api/clients-v1";

export type CreateClientBody = z.infer<typeof postClientBodySchema>;

export type CreateClientDeps = {
  clients: Pick<IClientRepository, "createClientStaff">;
  audit: IAuditRecorder;
  cache: Pick<ITenantListCache, "revalidateClientsList">;
};

/**
 * Cria paciente (`Client`), revalida lista, auditoria `PATIENT_CREATED`.
 */
export async function createClient(
  params: { tenantId: string; actorUserId: string; data: CreateClientBody },
  deps: CreateClientDeps,
): Promise<{ client: ClientDto }> {
  const { tenantId, actorUserId, data: d } = params;

  const row = await deps.clients.createClientStaff({
    tenantId,
    name: d.name,
    phone: d.phone,
    email: d.email,
    caseDescription: d.caseDescription,
    documentId: d.documentId,
    postalCode: d.postalCode,
    addressLine: d.addressLine,
    addressNumber: d.addressNumber,
    addressComp: d.addressComp,
    neighborhood: d.neighborhood,
    city: d.city,
    state: d.state,
    isMinor: d.isMinor,
    birthDate: d.birthDate,
    guardianName: d.guardianName,
    guardianDocumentId: d.guardianDocumentId,
    guardianPhone: d.guardianPhone,
    guardianEmail: d.guardianEmail,
    guardianRelationship: d.guardianRelationship,
    emergencyContactName: d.emergencyContactName,
    emergencyContactPhone: d.emergencyContactPhone,
    preferredChannel: d.preferredChannel,
    assignedToUserId: d.assignedToUserId,
    opmeSupplierId: d.opmeSupplierId,
  });

  deps.cache.revalidateClientsList(tenantId);

  await deps.audit.record({
    tenantId,
    clientId: (row as { id: string }).id,
    patientPathwayId: null,
    actorUserId,
    type: AuditEventType.PATIENT_CREATED,
    payload: { clientId: (row as { id: string }).id },
  });

  return { client: mapPrismaClientRowToClientDto(row as Parameters<typeof mapPrismaClientRowToClientDto>[0]) };
}
