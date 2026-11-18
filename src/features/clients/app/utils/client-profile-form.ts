import type {
  ClientProfileDraft,
  ClientProfileValidationError,
} from "@/features/clients/app/types/client-profile";
import { normNullable } from "@/lib/utils/string";
import { digitsOnlyCep } from "@/lib/validators/cep";
import { digitsOnlyCpf } from "@/lib/validators/cpf";
import type { PatchPatientPortalProfileBody } from "@/lib/validators/patient-portal-profile";
import { digitsOnlyPhone, phoneDigitsSchema } from "@/lib/validators/phone";
import type { ClientDetailClientDto, PatchClientRequestBody } from "@/types/api/clients-v1";
import type { GuardianRelationship } from "@prisma/client";

/** Valor sentinela do Select de responsável/OPME ("nenhum"). */
export const NONE = "__none__";
/** Valor sentinela do Select de parentesco ("nenhum"). */
export const REL_NONE = "__rel_none__";

type Client = ClientDetailClientDto;

export function draftFromClient(client: Client): ClientProfileDraft {
  return {
    name: client.name,
    phoneDigits: digitsOnlyPhone(client.phone),
    email: client.email ?? "",
    documentDigits: digitsOnlyCpf(client.documentId ?? ""),
    assigned: client.assignedToUserId ?? NONE,
    opme: client.opmeSupplierId ?? NONE,
    postalCode: digitsOnlyCep(client.postalCode ?? ""),
    addressLine: client.addressLine ?? "",
    addressNumber: client.addressNumber ?? "",
    addressComp: client.addressComp ?? "",
    neighborhood: client.neighborhood ?? "",
    city: client.city ?? "",
    state: (client.state ?? "").toUpperCase(),
    isMinor: client.isMinor,
    guardianName: client.guardianName ?? "",
    guardianDocumentDigits: digitsOnlyCpf(client.guardianDocumentId ?? ""),
    guardianPhoneDigits: digitsOnlyPhone(client.guardianPhone ?? ""),
    guardianEmail: client.guardianEmail ?? "",
    guardianRelationship: client.guardianRelationship ?? REL_NONE,
    birthDate: client.birthDate ?? "",
    emergencyName: client.emergencyContactName ?? "",
    emergencyPhoneDigits: digitsOnlyPhone(client.emergencyContactPhone ?? ""),
    preferredChannel: client.preferredChannel,
  };
}

function isAddressDirty(draft: ClientProfileDraft, client: Client): boolean {
  const cepDigits = digitsOnlyCep(draft.postalCode);
  const cepNorm = cepDigits.length === 8 ? cepDigits : "";
  return (
    cepNorm !== (client.postalCode ?? "") ||
    normNullable(draft.addressLine) !== normNullable(client.addressLine) ||
    normNullable(draft.addressNumber) !== normNullable(client.addressNumber) ||
    normNullable(draft.addressComp) !== normNullable(client.addressComp) ||
    normNullable(draft.neighborhood) !== normNullable(client.neighborhood) ||
    normNullable(draft.city) !== normNullable(client.city) ||
    normNullable(draft.state) !== normNullable(client.state?.toUpperCase() ?? null)
  );
}

function isGuardianDirty(draft: ClientProfileDraft, client: Client): boolean {
  return (
    draft.isMinor !== client.isMinor ||
    normNullable(draft.guardianName) !== normNullable(client.guardianName) ||
    digitsOnlyCpf(draft.guardianDocumentDigits) !== digitsOnlyCpf(client.guardianDocumentId ?? "") ||
    digitsOnlyPhone(draft.guardianPhoneDigits) !== digitsOnlyPhone(client.guardianPhone ?? "") ||
    draft.guardianEmail.trim() !== (client.guardianEmail ?? "").trim() ||
    (draft.guardianRelationship === REL_NONE ? null : draft.guardianRelationship) !==
      (client.guardianRelationship ?? null)
  );
}

function isStaffExtraDirty(draft: ClientProfileDraft, client: Client): boolean {
  return (
    draft.birthDate !== (client.birthDate ?? "") ||
    normNullable(draft.emergencyName) !== normNullable(client.emergencyContactName) ||
    digitsOnlyPhone(draft.emergencyPhoneDigits) !==
      digitsOnlyPhone(client.emergencyContactPhone ?? "") ||
    draft.preferredChannel !== client.preferredChannel
  );
}

export function isProfileDirty(draft: ClientProfileDraft, client: Client, isPatient: boolean): boolean {
  const emailNorm = draft.email.trim() === "" ? null : draft.email.trim();
  const contactDirty =
    digitsOnlyPhone(draft.phoneDigits) !== digitsOnlyPhone(client.phone) ||
    emailNorm !== client.email ||
    draft.documentDigits !== digitsOnlyCpf(client.documentId ?? "") ||
    isAddressDirty(draft, client);

  if (isPatient) return draft.name.trim() !== client.name.trim() || contactDirty;

  const assigned = draft.assigned === NONE ? null : draft.assigned;
  const opme = draft.opme === NONE ? null : draft.opme;
  return (
    contactDirty ||
    assigned !== client.assignedToUserId ||
    opme !== client.opmeSupplierId ||
    isGuardianDirty(draft, client) ||
    isStaffExtraDirty(draft, client)
  );
}

function validateCpf(
  documentDigits: string,
  isRequired: boolean,
): ClientProfileValidationError | null {
  if (isRequired && documentDigits.length !== 11) {
    return {
      scope: "api",
      key: documentDigits.length === 0 ? "errors.validationCpfRequired" : "errors.validationCpf11Digits",
    };
  }
  if (!isRequired && documentDigits.length > 0 && documentDigits.length !== 11) {
    return { scope: "api", key: "errors.validationCpf11Digits" };
  }
  return null;
}

function validateStaffGuardian(draft: ClientProfileDraft): ClientProfileValidationError | null {
  if (!draft.guardianName.trim()) {
    return { scope: "api", key: "errors.validationGuardianNameRequired" };
  }
  if (digitsOnlyCpf(draft.guardianDocumentDigits).length !== 11) {
    return { scope: "api", key: "errors.validationGuardianCpfRequired" };
  }
  if (draft.guardianRelationship === REL_NONE) {
    return { scope: "api", key: "errors.validationGuardianRelationshipRequired" };
  }
  return null;
}

type ValidateProfileInput = {
  draft: ClientProfileDraft;
  client: Client;
  isPatient: boolean;
  hasTenantSlug: boolean;
};

/** Primeira falha de validação local (mesma ordem de checagem da UI), ou `null` se válido. */
export function validateProfile({
  draft,
  client,
  isPatient,
  hasTenantSlug,
}: ValidateProfileInput): ClientProfileValidationError | null {
  const phoneDigits = digitsOnlyPhone(draft.phoneDigits);
  const emailTrim = draft.email.trim();
  // Paciente: `isMinor` é somente leitura (vem do servidor); equipe edita o rascunho.
  const effectiveIsMinor = isPatient ? client.isMinor : draft.isMinor;

  if (phoneDigits.length > 0 && !phoneDigitsSchema.safeParse(phoneDigits).success) {
    return { scope: "api", key: "errors.validationPhoneBrDigits" };
  }
  if (!effectiveIsMinor && phoneDigits.length === 0) {
    return { scope: "api", key: "errors.validationPhoneBrDigits" };
  }
  if (!effectiveIsMinor && !emailTrim) {
    return { scope: "api", key: "errors.validationEmailRequired" };
  }

  if (isPatient) {
    if (!draft.name.trim()) return { scope: "profile", key: "nameRequired" };
    if (!hasTenantSlug) return { scope: "profile", key: "saveError" };
    return validateCpf(draft.documentDigits, !client.isMinor);
  }

  if (draft.isMinor) {
    const guardianError = validateStaffGuardian(draft);
    if (guardianError) return guardianError;
    return validateCpf(draft.documentDigits, false);
  }
  return validateCpf(draft.documentDigits, true);
}

/** Campos de endereço alterados (compartilhado entre paciente e equipe). */
function buildAddressPatch(draft: ClientProfileDraft, client: Client) {
  const patch: Partial<
    Pick<
      PatchClientRequestBody,
      "postalCode" | "addressLine" | "addressNumber" | "addressComp" | "neighborhood" | "city" | "state"
    >
  > = {};
  const cepDigits = digitsOnlyCep(draft.postalCode);
  const cepVal = cepDigits.length === 8 ? cepDigits : null;
  const serverCep = client.postalCode ?? "";
  if (cepVal !== (serverCep.length === 8 ? serverCep : null)) patch.postalCode = cepVal;
  if (normNullable(draft.addressLine) !== normNullable(client.addressLine)) {
    patch.addressLine = normNullable(draft.addressLine);
  }
  if (normNullable(draft.addressNumber) !== normNullable(client.addressNumber)) {
    patch.addressNumber = normNullable(draft.addressNumber);
  }
  if (normNullable(draft.addressComp) !== normNullable(client.addressComp)) {
    patch.addressComp = normNullable(draft.addressComp);
  }
  if (normNullable(draft.neighborhood) !== normNullable(client.neighborhood)) {
    patch.neighborhood = normNullable(draft.neighborhood);
  }
  if (normNullable(draft.city) !== normNullable(client.city)) patch.city = normNullable(draft.city);
  if (normNullable(draft.state) !== normNullable(client.state)) {
    patch.state = normNullable(draft.state)?.toUpperCase() ?? null;
  }
  return patch;
}

export function buildPatientPatch(
  draft: ClientProfileDraft,
  client: Client,
): PatchPatientPortalProfileBody {
  const body: PatchPatientPortalProfileBody = {};
  const nameTrim = draft.name.trim();
  const phoneDigits = digitsOnlyPhone(draft.phoneDigits);
  const emailTrim = draft.email.trim();
  if (nameTrim !== client.name.trim()) body.name = nameTrim;
  if (phoneDigits !== digitsOnlyPhone(client.phone)) body.phone = phoneDigits;
  if ((emailTrim === "" ? null : emailTrim) !== client.email) body.email = emailTrim;
  if (digitsOnlyCpf(draft.documentDigits) !== digitsOnlyCpf(client.documentId ?? "")) {
    body.documentId = draft.documentDigits;
  }
  return { ...body, ...buildAddressPatch(draft, client) };
}

function buildStaffDocumentPatch(draft: ClientProfileDraft, client: Client) {
  const doc = draft.documentDigits;
  const serverDoc = digitsOnlyCpf(client.documentId ?? "");
  if (draft.isMinor && doc.length === 0) {
    return serverDoc.length > 0 ? { documentId: null } : {};
  }
  return doc !== serverDoc ? { documentId: doc } : {};
}

function buildGuardianPatch(draft: ClientProfileDraft, client: Client): PatchClientRequestBody {
  const body: PatchClientRequestBody = {};
  if (!draft.isMinor) return body;
  const gName = draft.guardianName.trim();
  const gDoc = digitsOnlyCpf(draft.guardianDocumentDigits);
  const gPhone = digitsOnlyPhone(draft.guardianPhoneDigits);
  if (draft.isMinor !== client.isMinor) {
    body.guardianName = gName;
    body.guardianDocumentId = gDoc;
    body.guardianPhone = gPhone.length > 0 ? gPhone : null;
  } else {
    if (gName !== (client.guardianName ?? "").trim()) body.guardianName = gName;
    if (gDoc !== digitsOnlyCpf(client.guardianDocumentId ?? "")) body.guardianDocumentId = gDoc;
    if (gPhone !== digitsOnlyPhone(client.guardianPhone ?? "")) {
      body.guardianPhone = gPhone.length > 0 ? gPhone : null;
    }
  }
  const gEmailTrim = draft.guardianEmail.trim();
  if (gEmailTrim !== (client.guardianEmail ?? "").trim()) {
    body.guardianEmail = gEmailTrim === "" ? null : gEmailTrim;
  }
  const rel =
    draft.guardianRelationship === REL_NONE
      ? null
      : (draft.guardianRelationship as GuardianRelationship);
  if (rel !== client.guardianRelationship) body.guardianRelationship = rel;
  return body;
}

function buildStaffExtraPatch(draft: ClientProfileDraft, client: Client): PatchClientRequestBody {
  const body: PatchClientRequestBody = {};
  const birthTrim = draft.birthDate.trim();
  if (birthTrim !== (client.birthDate ?? "")) body.birthDate = birthTrim === "" ? null : birthTrim;

  const emName = normNullable(draft.emergencyName);
  const emPhone = digitsOnlyPhone(draft.emergencyPhoneDigits);
  if (emName !== normNullable(client.emergencyContactName)) body.emergencyContactName = emName;
  if (emPhone !== digitsOnlyPhone(client.emergencyContactPhone ?? "")) {
    body.emergencyContactPhone = emPhone.length > 0 ? emPhone : null;
  }
  if (draft.preferredChannel !== client.preferredChannel) {
    body.preferredChannel = draft.preferredChannel;
  }

  const assigned = draft.assigned === NONE ? null : draft.assigned;
  const opme = draft.opme === NONE ? null : draft.opme;
  if (assigned !== client.assignedToUserId) body.assignedToUserId = assigned;
  if (opme !== client.opmeSupplierId) body.opmeSupplierId = opme;
  return body;
}

export function buildStaffPatch(draft: ClientProfileDraft, client: Client): PatchClientRequestBody {
  const body: PatchClientRequestBody = {};
  const phoneDigits = digitsOnlyPhone(draft.phoneDigits);
  const emailTrim = draft.email.trim();
  const emailNorm = emailTrim === "" ? null : emailTrim;
  if (phoneDigits !== digitsOnlyPhone(client.phone)) body.phone = phoneDigits;
  if (emailNorm !== client.email) body.email = emailNorm;
  if (draft.isMinor !== client.isMinor) body.isMinor = draft.isMinor;
  return {
    ...body,
    ...buildStaffDocumentPatch(draft, client),
    ...buildGuardianPatch(draft, client),
    ...buildAddressPatch(draft, client),
    ...buildStaffExtraPatch(draft, client),
  };
}
