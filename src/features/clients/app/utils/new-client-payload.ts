import type { NewClientFormValues } from "@/features/clients/app/utils/schemas";
import { PatientPreferredChannel } from "@prisma/client";

/** Sentinela dos Selects de responsável/OPME ("nenhum"). */
export const PICKER_NONE = "__none__";

const trimmedOrUndefined = (value: unknown) => String(value ?? "").trim() || undefined;

/** Entrada para `postClientBodySchema.safeParse`: normaliza strings vazias do formulário. */
export function buildNewClientPayloadInput(
  values: NewClientFormValues,
  assignedToUserId: string,
  opmeSupplierId: string,
) {
  return {
    name: String(values.name ?? "").trim(),
    phone: String(values.phone ?? ""),
    caseDescription: trimmedOrUndefined(values.caseDescription),
    documentId: values.documentId ?? "",
    email: String(values.email ?? "").trim(),
    assignedToUserId: assignedToUserId === PICKER_NONE ? undefined : assignedToUserId,
    opmeSupplierId: opmeSupplierId === PICKER_NONE ? undefined : opmeSupplierId,
    isMinor: Boolean(values.isMinor),
    guardianName: trimmedOrUndefined(values.guardianName),
    guardianDocumentId: values.guardianDocumentId ?? "",
    guardianPhone: String(values.guardianPhone ?? ""),
    guardianEmail: trimmedOrUndefined(values.guardianEmail),
    birthDate: trimmedOrUndefined(values.birthDate),
    guardianRelationship: values.guardianRelationship,
    emergencyContactName: trimmedOrUndefined(values.emergencyContactName),
    emergencyContactPhone: String(values.emergencyContactPhone ?? ""),
    preferredChannel: values.preferredChannel ?? PatientPreferredChannel.none,
    postalCode: trimmedOrUndefined(values.postalCode),
    addressLine: trimmedOrUndefined(values.addressLine),
    addressNumber: trimmedOrUndefined(values.addressNumber),
    addressComp: trimmedOrUndefined(values.addressComp),
    neighborhood: trimmedOrUndefined(values.neighborhood),
    city: trimmedOrUndefined(values.city),
    state: trimmedOrUndefined(values.state),
  };
}
