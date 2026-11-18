import type { ClientDetailClientDto } from "@/types/api/clients-v1";

/** Rascunho editável da ficha do paciente (valores como digitados/mascarados na UI). */
export type ClientProfileDraft = {
  name: string;
  phoneDigits: string;
  email: string;
  documentDigits: string;
  assigned: string;
  opme: string;
  postalCode: string;
  addressLine: string;
  addressNumber: string;
  addressComp: string;
  neighborhood: string;
  city: string;
  state: string;
  isMinor: boolean;
  guardianName: string;
  guardianDocumentDigits: string;
  guardianPhoneDigits: string;
  guardianEmail: string;
  guardianRelationship: string;
  birthDate: string;
  emergencyName: string;
  emergencyPhoneDigits: string;
  preferredChannel: ClientDetailClientDto["preferredChannel"];
};

/** Erro de validação local: qual namespace de i18n (`api` ou `clients.detail.profile`) e a chave. */
export type ClientProfileValidationError = {
  scope: "api" | "profile";
  key: string;
};

/** Props comuns das seções do formulário de ficha (rascunho + setter por campo). */
export type ClientProfileSectionProps = {
  client: ClientDetailClientDto;
  draft: ClientProfileDraft;
  setField: <K extends keyof ClientProfileDraft>(key: K, value: ClientProfileDraft[K]) => void;
  saving: boolean;
  isPatient: boolean;
};
