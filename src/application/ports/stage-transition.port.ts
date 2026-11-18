import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type { PatientPathwayStageState, PendingChecklistItem } from "@/domain/pathway/stage-transition-rules";
import type {
  IStageDocumentBundleReader,
  ITenantMemberPicker,
} from "@/application/ports/stage-shared.port";

/** `PatientPathway` carregado para decidir a transição (fora da transação). */
export type PatientPathwayForTransition = {
  id: string;
  clientId: string;
  pathwayVersionId: string;
  currentStageId: string;
  completedAt: Date | null;
  client: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    assignedToUserId: string | null;
  };
};

export type TransitionTargetStage = {
  id: string;
  name: string;
  patientMessage: string | null;
  defaultAssigneeUserIds: string[];
  defaultAssigneeUserId: string | null;
};

/** Linha do paciente após a transição (a serialização para API fica no use case). */
export type PatientPathwayViewRow = {
  id: string;
  currentStage: unknown;
  currentStageAssignee: { id: string; name: string | null; email: string } | null;
  enteredStageAt: Date;
  updatedAt: Date;
  currentStageAssigneeUserId: string | null;
};

export type CreateStageTransitionRecord = {
  patientPathwayId: string;
  fromStageId: string | null;
  toStageId: string;
  actorUserId: string;
  note: string | null;
  ruleOverrideReason: string | null;
  forcedByUserId: string | null;
  correlationId: string | null;
  dispatchStub: unknown;
};

export type ClaimStageParams = {
  tenantId: string;
  patientPathwayId: string;
  fromStageId: string;
  toStageId: string;
  enteredStageAt: Date;
  assigneeUserId: string | null;
};

/** Repositórios participando da mesma transação. */
export interface IStageTransitionTx extends IStageDocumentBundleReader, ITenantMemberPicker {
  readonly audit: IAuditRecorder;
  findPatientPathwayState(
    tenantId: string,
    patientPathwayId: string,
  ): Promise<(PatientPathwayStageState & { currentStageName: string | null }) | null>;
  listPendingRequiredChecklistItems(
    patientPathwayId: string,
    stageId: string,
  ): Promise<PendingChecklistItem[]>;
  /** Update condicional (etapa atual == `fromStageId` e não concluída). `false` = perdeu a corrida. */
  claimStage(params: ClaimStageParams): Promise<boolean>;
  createStageTransition(record: CreateStageTransitionRecord): Promise<{ id: string }>;
  loadPatientPathwayView(patientPathwayId: string): Promise<PatientPathwayViewRow>;
  findTransitionByCorrelation(
    patientPathwayId: string,
    correlationId: string,
  ): Promise<{ toStageId: string } | null>;
}

export interface IStageTransitionStore {
  findPatientPathwayForTransition(
    tenantId: string,
    patientPathwayId: string,
  ): Promise<PatientPathwayForTransition | null>;
  findStageInVersion(pathwayVersionId: string, stageId: string): Promise<TransitionTargetStage | null>;
  /** Unit of work: o callback recebe repositórios transacionais (nunca o client Prisma cru). */
  runInTransaction<T>(fn: (tx: IStageTransitionTx) => Promise<T>): Promise<T>;
}
