import type { WhatsAppDispatchInput } from "@/application/ports/whatsapp-dispatcher.port";

export type StageTransitionPatientEmailInput = {
  tenantId: string;
  to: string;
  jobId: string;
  data: {
    patientName: string;
    stageName: string;
    patientMessage: string | null;
    documents: { fileName: string }[];
    portalUrl: string;
    clinicName: string;
  };
};

/** Confirmação à equipe de que o pacote de documentos da etapa saiu para o paciente. */
export type DocumentDeliveryStaffEmailInput = {
  tenantId: string;
  transitionId: string;
  /** Quem moveu o paciente de etapa e o responsável pela etapa (o adapter filtra membros e duplicados). */
  candidateUserIds: string[];
  client: { id: string; name: string; email: string | null; phone: string | null };
  stageName: string;
  documents: { fileName: string }[];
};

export interface IEmailDispatchQueue {
  enqueueStageTransitionPatientEmail(input: StageTransitionPatientEmailInput): Promise<void>;
  enqueueDocumentDeliveryStaffEmail(input: DocumentDeliveryStaffEmailInput): Promise<void>;
}

export interface IWhatsAppDispatchQueue {
  enqueue(input: WhatsAppDispatchInput): Promise<void>;
}
