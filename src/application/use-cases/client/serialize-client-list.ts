import type { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import { computeSlaHealthStatus } from "@/domain/pathway/sla-health";
import {
  type ClientListRow,
  CLIENT_LIST_INCLUDE,
  buildClientsListBaseWhere,
  clientSearchWhere,
  reviveClientListRows,
} from "@/infrastructure/repositories/client-query-shapes";
import type { ClientDto } from "@/types/api/clients-v1";

export { CLIENT_LIST_INCLUDE, buildClientsListBaseWhere, clientSearchWhere, reviveClientListRows };
export type { ClientListRow };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isValidDate(d: unknown): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime());
}

/** Evita `RangeError` se `Date` vier inválido após cache/JSON (ex.: Vercel + `unstable_cache`). */
function toIsoSafe(d: Date): string {
  return isValidDate(d) ? d.toISOString() : new Date(0).toISOString();
}

/** `Client.birthDate` (`@db.Date`) → `YYYY-MM-DD` para DTOs JSON. */
export function formatClientBirthDateIso(d: Date | null | undefined): string | null {
  if (!isValidDate(d)) return null;
  return d.toISOString().slice(0, 10);
}

function baseClientFields(c: ClientListRow) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    caseDescription: c.caseDescription,
    documentId: c.documentId,
    postalCode: c.postalCode,
    addressLine: c.addressLine,
    addressNumber: c.addressNumber,
    addressComp: c.addressComp,
    neighborhood: c.neighborhood,
    city: c.city,
    state: c.state,
    isMinor: c.isMinor,
    birthDate: formatClientBirthDateIso(c.birthDate),
    guardianName: c.guardianName,
    guardianDocumentId: c.guardianDocumentId,
    guardianPhone: c.guardianPhone,
    guardianEmail: c.guardianEmail,
    guardianRelationship: c.guardianRelationship,
    emergencyContactName: c.emergencyContactName,
    emergencyContactPhone: c.emergencyContactPhone,
    preferredChannel: c.preferredChannel,
    assignedToUserId: c.assignedToUserId,
    opmeSupplierId: c.opmeSupplierId,
    assignedTo: c.assignedTo
      ? { id: c.assignedTo.id, name: c.assignedTo.name, email: c.assignedTo.email }
      : null,
    opmeSupplier: c.opmeSupplier ? { id: c.opmeSupplier.id, name: c.opmeSupplier.name } : null,
    createdAt: toIsoSafe(c.createdAt),
    updatedAt: toIsoSafe(c.updatedAt),
  };
}

/** Monta `ClientDto` a partir de linha Prisma (ex.: `POST`/`PATCH` com `select` + relações). */
export function mapPrismaClientRowToClientDto(row: {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  caseDescription: string | null;
  documentId: string | null;
  postalCode: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  isMinor: boolean;
  birthDate: Date | null;
  guardianName: string | null;
  guardianDocumentId: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  guardianRelationship: GuardianRelationship | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  preferredChannel: PatientPreferredChannel;
  assignedToUserId: string | null;
  opmeSupplierId: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignedTo: { id: string; name: string | null; email: string } | null;
  opmeSupplier: { id: string; name: string } | null;
  patientPathways?: { id: string }[];
}): ClientDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    caseDescription: row.caseDescription,
    documentId: row.documentId,
    postalCode: row.postalCode,
    addressLine: row.addressLine,
    addressNumber: row.addressNumber,
    addressComp: row.addressComp,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    isMinor: row.isMinor,
    birthDate: formatClientBirthDateIso(row.birthDate),
    guardianName: row.guardianName,
    guardianDocumentId: row.guardianDocumentId,
    guardianPhone: row.guardianPhone,
    guardianEmail: row.guardianEmail,
    guardianRelationship: row.guardianRelationship,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    preferredChannel: row.preferredChannel,
    assignedToUserId: row.assignedToUserId,
    opmeSupplierId: row.opmeSupplierId,
    assignedTo: row.assignedTo
      ? { id: row.assignedTo.id, name: row.assignedTo.name, email: row.assignedTo.email }
      : null,
    opmeSupplier: row.opmeSupplier ? { id: row.opmeSupplier.id, name: row.opmeSupplier.name } : null,
    patientPathwayId: row.patientPathways?.[0]?.id ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeClientListItem(c: ClientListRow, now: Date) {
  const pp = c.patientPathways?.[0] ?? null;
  if (!pp) {
    return {
      ...baseClientFields(c),
      patientPathwayId: null,
      pathwayId: null,
      pathwayName: null,
      currentStageId: null,
      currentStageName: null,
      daysInStage: null,
      slaStatus: null,
      journeyCompletedAt: null,
    };
  }

  const pathwayName = pp.pathway?.name ?? null;

  if (pp.completedAt && isValidDate(pp.completedAt)) {
    return {
      ...baseClientFields(c),
      patientPathwayId: pp.id,
      pathwayId: pp.pathwayId,
      pathwayName,
      currentStageId: null,
      currentStageName: null,
      daysInStage: null,
      slaStatus: null,
      journeyCompletedAt: toIsoSafe(pp.completedAt),
    };
  }

  if (!pp.currentStage) {
    return {
      ...baseClientFields(c),
      patientPathwayId: pp.id,
      pathwayId: pp.pathwayId,
      pathwayName,
      currentStageId: null,
      currentStageName: null,
      daysInStage: null,
      slaStatus: null,
      journeyCompletedAt: pp.completedAt && isValidDate(pp.completedAt) ? toIsoSafe(pp.completedAt) : null,
    };
  }

  const entered = pp.enteredStageAt;
  if (!isValidDate(entered)) {
    return {
      ...baseClientFields(c),
      patientPathwayId: pp.id,
      pathwayId: pp.pathwayId,
      pathwayName,
      currentStageId: pp.currentStage.id,
      currentStageName: pp.currentStage.name,
      daysInStage: null,
      slaStatus: null,
      journeyCompletedAt: null,
    };
  }

  const daysInStage = Math.floor((now.getTime() - entered.getTime()) / MS_PER_DAY);
  const slaStatus = computeSlaHealthStatus(
    entered,
    now,
    pp.currentStage.alertWarningDays,
    pp.currentStage.alertCriticalDays,
  );

  return {
    ...baseClientFields(c),
    patientPathwayId: pp.id,
    pathwayId: pp.pathwayId,
    pathwayName,
    currentStageId: pp.currentStage.id,
    currentStageName: pp.currentStage.name,
    daysInStage,
    slaStatus,
    journeyCompletedAt: null,
  };
}
