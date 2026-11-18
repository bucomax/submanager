import type { PatientSelfRegisterFormValues } from "@/features/clients/app/utils/schemas";
import type { PublicPatientSelfRegisterFormPrefillDto } from "@/types/api/clients-v1";
import { PatientPreferredChannel } from "@prisma/client";

export const SELF_REGISTER_DEFAULT_VALUES: PatientSelfRegisterFormValues = {
  name: "",
  phone: "",
  caseDescription: "",
  documentId: "",
  email: "",
  isMinor: false,
  guardianName: "",
  guardianDocumentId: "",
  guardianPhone: "",
  guardianEmail: "",
  birthDate: "",
  guardianRelationship: undefined,
  emergencyContactName: "",
  emergencyContactPhone: "",
  preferredChannel: PatientPreferredChannel.none,
  postalCode: "",
  addressLine: "",
  addressNumber: "",
  addressComp: "",
  neighborhood: "",
  city: "",
  state: "",
  password: "",
  confirmPassword: "",
  acceptTerms: false,
  acceptPrivacy: false,
};

/** Valores do formulário a partir do convite amarrado a um paciente existente. */
export function valuesFromPrefill(
  prefill: PublicPatientSelfRegisterFormPrefillDto,
): PatientSelfRegisterFormValues {
  return {
    name: prefill.name,
    phone: prefill.phone,
    email: prefill.email ?? "",
    documentId: prefill.documentId ?? "",
    caseDescription: prefill.caseDescription ?? "",
    isMinor: prefill.isMinor,
    guardianName: prefill.guardianName ?? "",
    guardianDocumentId: prefill.guardianDocumentId ?? "",
    guardianPhone: prefill.guardianPhone ?? "",
    guardianEmail: prefill.guardianEmail ?? "",
    birthDate: prefill.birthDate ?? "",
    guardianRelationship: prefill.guardianRelationship ?? undefined,
    emergencyContactName: prefill.emergencyContactName ?? "",
    emergencyContactPhone: prefill.emergencyContactPhone ?? "",
    preferredChannel: prefill.preferredChannel ?? PatientPreferredChannel.none,
    postalCode: prefill.postalCode ?? "",
    addressLine: prefill.addressLine ?? "",
    addressNumber: prefill.addressNumber ?? "",
    addressComp: prefill.addressComp ?? "",
    neighborhood: prefill.neighborhood ?? "",
    city: prefill.city ?? "",
    state: prefill.state ?? "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
    acceptPrivacy: false,
  };
}
