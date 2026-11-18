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

export interface IEmailDispatchQueue {
  enqueueStageTransitionPatientEmail(input: StageTransitionPatientEmailInput): Promise<void>;
}

export interface IWhatsAppDispatchQueue {
  enqueue(input: WhatsAppDispatchInput): Promise<void>;
}
