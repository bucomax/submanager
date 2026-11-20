/**
 * Carga útil BullMQ / inline para envio de e-mail transacional (Resend).
 */
export type EmailDispatchJobPayload =
  | {
      kind: "stage_transition_patient";
      tenantId: string;
      to: string;
      data: {
        patientName: string;
        stageName: string;
        patientMessage: string | null;
        documents: { fileName: string }[];
        portalUrl: string;
        clinicName: string;
      };
    }
  | {
      kind: "sla_alert";
      tenantId: string;
      data: {
        severity: "warning" | "danger";
        patientName: string;
        stageName: string;
        daysInStage: number;
        slaThresholdDays: number;
        clientId: string;
        targetUserIds: string[];
        clinicName: string;
      };
    }
  | {
      kind: "file_pending_review_staff";
      tenantId: string;
      data: {
        patientName: string;
        fileName: string;
        clientId: string;
        fileAssetId: string;
        targetUserIds: string[];
        clinicName: string;
      };
    }
  | {
      kind: "surgery_reminder_staff";
      tenantId: string;
      data: {
        eventId: string;
        eventTitle: string;
        patientName: string;
        startsAtIso: string;
        durationMin: number;
        notes: string | null;
        stageName: string | null;
        pendingRequiredItems: number | null;
        clientId: string | null;
        targetUserIds: string[];
        clinicName: string;
      };
    }
  | {
      kind: "weekly_report_staff";
      tenantId: string;
      data: {
        periodLabel: string;
        kpis: { patients: number; transitions: number; critical: number; pathways: number };
        byStatus: { ok: number; warning: number; danger: number };
        topStages: { label: string; count: number }[];
        critical: { clientId: string; name: string; stageName: string; daysInStage: number }[];
        criticalTotal: number;
        targetUserIds: string[];
        clinicName: string;
      };
    }
  | {
      kind: "document_delivery_staff";
      tenantId: string;
      data: {
        patientName: string;
        clientId: string;
        stageName: string;
        documents: string[];
        /** Destinos já mascarados; null quando o canal não foi usado. */
        emailTo: string | null;
        whatsappTo: string | null;
        targetUserIds: string[];
        clinicName: string;
      };
    }
  | {
      kind: "checklist_complete_staff";
      tenantId: string;
      data: {
        patientName: string;
        stageName: string;
        totalRequiredItems: number;
        clientId: string;
        targetUserIds: string[];
        clinicName: string;
      };
    };
