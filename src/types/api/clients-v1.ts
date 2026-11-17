import type { GuardianRelationship, PatientPreferredChannel } from "@prisma/client";
import type { ApiPagination } from "@/lib/api/pagination";
import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import {
  patchClientBodySchema,
  postClientBodySchema,
  postPatientSelfRegisterInviteBodySchema,
  publicPatientSelfRegisterBodySchema,
} from "@/lib/validators/client";
import { z } from "zod";

/** Paciente retornado por `POST /api/v1/clients` e corpo base em listagens. */
export type ClientDto = {
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
  birthDate: string | null;
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
  assignedTo: { id: string; name: string | null; email: string } | null;
  opmeSupplier: { id: string; name: string } | null;
  patientPathwayId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Linha de `GET /api/v1/clients` com jornada e SLA derivados. */
export type ClientListItemDto = ClientDto & {
  pathwayId: string | null;
  pathwayName: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  daysInStage: number | null;
  slaStatus: SlaHealthStatus | null;
  /** Preenchido quando a jornada exibida (a mais recente) está concluída; SLA/dias não se aplicam. */
  journeyCompletedAt: string | null;
};

export type PublishedStageRowDto = {
  id: string;
  stageKey: string;
  name: string;
  sortOrder: number;
  patientMessage: string | null;
  alertWarningDays: number | null;
  alertCriticalDays: number | null;
  /** Responsável padrão da etapa (membro do tenant). */
  defaultAssigneeUserId: string | null;
  /** Lista de responsáveis padrão (ordem preservada). */
  defaultAssigneeUserIds: string[];
};

/** Item de `GET /api/v1/pathways` (seletor de jornada / filtros). */
export type PathwayOption = {
  id: string;
  name: string;
  description: string | null;
  publishedVersion: { id: string; version: number } | null;
  createdAt: string;
  updatedAt: string;
};

export type StageAssigneeSummaryDto = {
  id: string;
  name: string | null;
  email: string;
};

export type PatientPathwayCreated = {
  id: string;
  client: { id: string; name: string; phone: string };
  pathway: { id: string; name: string };
  currentStage: { id: string; name: string; stageKey: string };
  currentStageAssignee: StageAssigneeSummaryDto | null;
  createdAt: string;
};

/** Filtro de coluna SLA na listagem (`status` em `GET /api/v1/clients`). */
export type ClientListStatusFilter = SlaHealthStatus | "completed";

/** Query string de `GET /api/v1/clients`. */
export type ListClientsQueryParams = {
  limit?: number;
  page?: number;
  q?: string;
  pathwayId?: string;
  stageId?: string;
  status?: ClientListStatusFilter;
  /** Quando true, a API consulta o banco sem cache incremental (útil após mutações). */
  fresh?: boolean;
};

/** Corpo `POST /api/v1/clients` após validação Zod (`documentId` = 11 dígitos ou null). */
export type CreateClientRequestBody = z.infer<typeof postClientBodySchema>;

/** Corpo `data` de sucesso de `GET /api/v1/clients` (dentro do envelope). */
export type ClientsListResponseData = {
  data: ClientListItemDto[];
  pagination: ApiPagination;
  statusFilterCapped: boolean;
};

/** Corpo `data` de `GET /api/v1/pathways`. */
export type PathwaysListResponseData = {
  pathways: PathwayOption[];
};

/** Corpo `data` de `POST /api/v1/clients`. */
export type CreateClientResponseData = {
  client: ClientDto;
};

/** Corpo `data` de `POST /api/v1/patient-pathways`. */
export type CreatePatientPathwayResponseData = {
  patientPathway: PatientPathwayCreated;
};

export type CreatePatientPathwayRequestBody = {
  clientId: string;
  pathwayId: string;
};

/** Corpo `data` de `GET /api/v1/pathways/{id}/published-stages`. */
export type PublishedPathwayStagesResponseData = {
  pathwayId: string;
  version: { stages: PublishedStageRowDto[] };
};

/** Paciente em `GET /api/v1/clients/:id` (sem `patientPathwayId` redundante no topo). */
export type ClientDetailClientDto = {
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
  birthDate: string | null;
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
  assignedTo: { id: string; name: string | null; email: string } | null;
  opmeSupplier: { id: string; name: string } | null;
  patientPathwayId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientDetailStageDocumentDto = {
  id: string;
  sortOrder: number;
  file: { id: string; fileName: string; mimeType: string };
};

export type ClientDetailChecklistItemDto = {
  id: string;
  label: string;
  sortOrder: number;
  /** Obrigatório concluir antes de transicionar (salvo override auditado). */
  requiredForTransition: boolean;
  completed: boolean;
  completedAt: string | null;
};

export type ClientDetailStageDto = {
  id: string;
  name: string;
  stageKey: string;
  sortOrder: number;
  /** Mensagem operacional da etapa (ex.: orientação à equipe). */
  patientMessage: string | null;
  alertWarningDays: number | null;
  alertCriticalDays: number | null;
  /** Primeiro id da lista pública (alinhado à relação Prisma `defaultAssigneeUser`). */
  defaultAssigneeUserId: string | null;
  /** Responsáveis padrão da etapa no template publicado (ordem preservada). */
  defaultAssigneeUserIds: string[];
  defaultAssignees: StageAssigneeSummaryDto[];
  documents: ClientDetailStageDocumentDto[];
  checklistItems: ClientDetailChecklistItemDto[];
};

export type ClientDetailTransitionDto = {
  id: string;
  fromStage: { id: string; name: string; stageKey: string } | null;
  toStage: { id: string; name: string; stageKey: string };
  note: string | null;
  /** Justificativa quando a transição ignorou checklist obrigatório. */
  ruleOverrideReason: string | null;
  forcedBy: { id: string; name: string | null; email: string } | null;
  actor: { id: string; name: string | null; email: string };
  createdAt: string;
};

/** Categoria de UI para ícone/cor na linha do tempo (derivada do tipo de audit ou transição legada). */
export type ClientTimelineEventCategory =
  | "security"
  | "clinical"
  | "documents"
  | "administrative"
  | "compliance";

/** Valores de `AuditEvent.type` expostos na API (espelho do enum Prisma). */
export type ClientTimelineAuditEventType =
  | "STAGE_TRANSITION"
  | "FILE_UPLOADED_TO_CLIENT"
  | "SELF_REGISTER_COMPLETED"
  | "PATIENT_PORTAL_FILE_SUBMITTED"
  | "PATIENT_PORTAL_FILE_APPROVED"
  | "PATIENT_PORTAL_FILE_REJECTED"
  | "PATIENT_PORTAL_PASSWORD_SET"
  | "STAFF_LOGIN_SUCCESS"
  | "STAFF_LOGIN_FAILED"
  | "STAFF_PASSWORD_CHANGED"
  | "STAFF_PASSWORD_RESET"
  | "PATIENT_PORTAL_SESSION_CREATED"
  | "PATIENT_PORTAL_LINK_GENERATED"
  | "PATIENT_CREATED"
  | "PATIENT_UPDATED"
  | "PATIENT_DELETED"
  | "PATIENT_PATHWAY_STARTED"
  | "PATIENT_PATHWAY_COMPLETED"
  | "FILE_DOWNLOADED_BY_STAFF"
  | "FILE_DOWNLOADED_BY_PATIENT"
  | "CHECKLIST_ITEM_TOGGLED"
  | "FILE_DELETED"
  | "PATIENT_PORTAL_LOGIN_FAILED"
  | "PATIENT_CONSENT_GIVEN"
  | "AUDIT_EXPORT_GENERATED"
  | "WHATSAPP_DISPATCH_QUEUED"
  | "WHATSAPP_DISPATCH_SENT"
  | "WHATSAPP_DISPATCH_DELIVERED"
  | "WHATSAPP_DISPATCH_READ"
  | "WHATSAPP_DISPATCH_FAILED"
  | "WHATSAPP_PATIENT_CONFIRMED"
  | "TENANT_EMAIL_DOMAIN_CONFIGURED"
  | "TENANT_EMAIL_DOMAIN_REMOVED"
  | "SUPER_ADMIN_TENANT_ENTERED";

/** Transição legada na timeline (inclui instância da jornada). */
export type ClientTimelineLegacyTransitionDto = ClientDetailTransitionDto & {
  patientPathwayId: string;
};

export type ClientTimelineAuditItemDto = {
  kind: "audit";
  id: string;
  type: ClientTimelineAuditEventType;
  /** Categoria para filtro e indicador visual na UI. */
  category: ClientTimelineEventCategory;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
  patientPathwayId: string | null;
  /** Metadados mínimos (IDs, nomes de etapa em eventos de transição); sem texto clínico. */
  payload: Record<string, unknown>;
};

export type ClientTimelineLegacyItemDto = ClientTimelineLegacyTransitionDto & {
  kind: "legacy_transition";
  category: ClientTimelineEventCategory;
};

export type ClientTimelineItemDto = ClientTimelineAuditItemDto | ClientTimelineLegacyItemDto;

/** Linhas brutas para `mergeClientTimelinePage` (fetch no repositório). */
export type ClientTimelineMergeAuditRow = {
  id: string;
  type: ClientTimelineAuditEventType;
  createdAt: Date;
  payload: unknown;
  patientPathwayId: string | null;
  actor: { id: string; name: string | null; email: string } | null;
};

export type ClientTimelineMergeTransitionRow = {
  id: string;
  patientPathwayId: string;
  createdAt: Date;
  note: string | null;
  ruleOverrideReason: string | null;
  fromStage: { id: string; name: string; stageKey: string } | null;
  toStage: { id: string; name: string; stageKey: string };
  actor: { id: string; name: string | null; email: string };
  forcedByUser: { id: string; name: string | null; email: string } | null;
};

export type ClientTimelineMergeSources = {
  audits: ClientTimelineMergeAuditRow[];
  transitions: ClientTimelineMergeTransitionRow[];
};

/** `GET /api/v1/clients/:id/timeline` — `AuditEvent` + `StageTransition` deduplicados por `transitionId`. */
export type ClientTimelineResponseData = {
  items: ClientTimelineItemDto[];
  pagination: ApiPagination;
  /** True quando o merge atingiu teto de linhas buscadas no banco (lista pode estar incompleta). */
  timelineCapped: boolean;
};

export type ClientTimelineQueryParams = {
  page?: number;
  limit?: number;
  /** Filtro por categoria (`security`, `clinical`, …). Omitir = todas. */
  categories?: string;
};

/** Próximas etapas na ordem publicada (`sortOrder`), com responsável padrão do template. */
export type FollowingPublishedStageAssigneeHintDto = {
  id: string;
  name: string;
  stageKey: string;
  sortOrder: number;
  defaultAssigneeUserId: string | null;
  defaultAssigneeUserIds: string[];
  /** Primeiro resolvido (legado / atalho). */
  defaultAssignee: StageAssigneeSummaryDto | null;
  defaultAssignees: StageAssigneeSummaryDto[];
};

/**
 * Contexto passado / presente / futuro para responsabilidade (Fase 3).
 * “Futuro” segue ordem linear publicada; fluxos ramificados podem divergir.
 */
export type PatientPathwayAssigneeOverviewDto = {
  /** Etapa de origem da última transição que levou à etapa atual (null = início da jornada). */
  enteredCurrentStageFrom: { id: string; name: string; stageKey: string } | null;
  /** Quem registrou essa transição no sistema. */
  lastTransitionActor: StageAssigneeSummaryDto | null;
  followingStages: FollowingPublishedStageAssigneeHintDto[];
};

export type ClientPatientPathwayDetailDto = {
  id: string;
  completedAt: string | null;
  pathway: { id: string; name: string };
  pathwayVersion: { id: string; version: number; stages: ClientDetailStageDto[] };
  currentStage: ClientDetailStageDto | null;
  /** Responsável pela etapa atual nesta instância (Fase 1). */
  currentStageAssignee: StageAssigneeSummaryDto | null;
  /** Visão de responsáveis: origem, ator da transição e próximas etapas na ordem publicada (Fase 3). */
  assigneeOverview: PatientPathwayAssigneeOverviewDto;
  enteredStageAt: string;
  daysInStage: number;
  slaStatus: SlaHealthStatus;
  transitions: {
    data: ClientDetailTransitionDto[];
    pagination: ApiPagination;
  };
};

/** Jornada já encerrada — histórico na ficha do paciente (fora da jornada ativa). */
export type ClientCompletedTreatmentDto = {
  id: string;
  startedAt: string;
  completedAt: string;
  pathway: { id: string; name: string };
  pathwayVersion: { id: string; version: number; stages: ClientDetailStageDto[] };
  currentStage: ClientPatientPathwayDetailDto["currentStage"];
  /** Ordem cronológica (mais antiga primeiro). */
  transitions: ClientDetailTransitionDto[];
  /** Quando há mais transições do que o limite retornado pela API. */
  transitionsTruncated: boolean;
};

/** Corpo `data` de `GET /api/v1/clients/:id`. */
export type ClientDetailResponseData = {
  client: ClientDetailClientDto;
  /** Jornada em andamento (`completedAt` null), se existir. */
  patientPathway: ClientPatientPathwayDetailDto | null;
  /** Tratamentos concluídos, do mais recente ao mais antigo. */
  completedTreatments: ClientCompletedTreatmentDto[];
};

export type ClientDetailQueryParams = {
  page?: number;
  limit?: number;
};

export type PatchClientRequestBody = z.infer<typeof patchClientBodySchema>;

/** Corpo `data` de `PATCH /api/v1/clients/:id`. */
export type UpdateClientResponseData = {
  client: ClientDto;
};

/** Corpo opcional de `POST /api/v1/clients/self-register-invites`. */
export type CreatePatientSelfRegisterInviteRequestBody = z.infer<typeof postPatientSelfRegisterInviteBodySchema>;

/** `POST /api/v1/clients/self-register-invites` — link/QR para cadastro pelo paciente. */
export type CreatePatientSelfRegisterInviteResponseData = {
  token: string;
  expiresAt: string;
  registerUrl: string;
};

/** Dados do paciente já cadastrado para pré-preencher o formulário público (token válido + convite com escopo). */
export type PublicPatientSelfRegisterFormPrefillDto = {
  name: string;
  phone: string;
  email: string | null;
  documentId: string | null;
  caseDescription: string | null;
  postalCode: string | null;
  addressLine: string | null;
  addressNumber: string | null;
  addressComp: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianDocumentId: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  birthDate: string | null;
  guardianRelationship: GuardianRelationship | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  preferredChannel: PatientPreferredChannel;
};

/** `GET /api/v1/public/patient-self-register?token=` */
export type PublicPatientSelfRegisterValidateResponseData = {
  valid: boolean;
  tenantName?: string;
  /** CNPJ / identificador fiscal da clínica (quando cadastrado). */
  tenantTaxId?: string | null;
  expiresAt?: string;
  formPrefill?: PublicPatientSelfRegisterFormPrefillDto;
};

/** Corpo `POST /api/v1/public/patient-self-register` (campos do paciente + token) — entrada antes do `transform` do schema. */
export type PublicPatientSelfRegisterRequestBody = z.input<typeof publicPatientSelfRegisterBodySchema>;

/** `POST /api/v1/public/patient-self-register` — sucesso. */
export type PublicPatientSelfRegisterSubmitResponseData = {
  message: string;
};
