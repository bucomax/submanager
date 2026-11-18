import type { IAuditRecorder } from "@/application/ports/audit-recorder.port";
import type {
  IStageDocumentBundleReader,
  ITenantMemberPicker,
} from "@/application/ports/stage-shared.port";

export type StartStageRow = {
  id: string;
  name: string;
  stageKey: string;
  sortOrder: number;
  patientMessage: string | null;
  alertWarningDays: number | null;
  alertCriticalDays: number | null;
  defaultAssigneeUserId: string | null;
  defaultAssigneeUserIds: string[];
};

export type PublishedVersionForStart = { id: string; stages: StartStageRow[] };

export type CreatedPatientPathwayRow = {
  id: string;
  clientId: string;
  currentStageAssigneeUserId: string | null;
  enteredStageAt: Date;
  createdAt: Date;
  currentStage: StartStageRow;
  pathway: { id: string; name: string };
  client: { id: string; name: string; phone: string };
  currentStageAssignee: { id: string; name: string | null; email: string } | null;
};

export type CreatePatientPathwayRecord = {
  tenantId: string;
  clientId: string;
  pathwayId: string;
  pathwayVersionId: string;
  currentStageId: string;
  enteredStageAt: Date;
  currentStageAssigneeUserId: string | null;
};

export interface IPatientPathwayStartTx extends IStageDocumentBundleReader, ITenantMemberPicker {
  readonly audit: IAuditRecorder;
  /** Serializa criações concorrentes para o mesmo paciente (duplo clique / retry). */
  lockClient(clientId: string): Promise<void>;
  hasActivePatientPathway(clientId: string): Promise<boolean>;
  createPatientPathway(record: CreatePatientPathwayRecord): Promise<CreatedPatientPathwayRow>;
  createInitialTransition(record: {
    patientPathwayId: string;
    toStageId: string;
    actorUserId: string;
    dispatchStub: unknown;
  }): Promise<{ id: string }>;
}

export interface IPatientPathwayStartStore {
  findActivePatientPathwayId(clientId: string): Promise<{ id: string } | null>;
  findCarePathwayId(tenantId: string, pathwayId: string): Promise<{ id: string } | null>;
  /** Versão publicada mais recente, com a primeira etapa (por `sortOrder`). */
  findPublishedVersionWithFirstStage(pathwayId: string): Promise<PublishedVersionForStart | null>;
  runInTransaction<T>(fn: (tx: IPatientPathwayStartTx) => Promise<T>): Promise<T>;
}
