import {
  getChecklistCompleteStaffHtml,
  getDocumentDeliveryStaffHtml,
  getFilePendingReviewStaffHtml,
  getSlaAlertStaffHtml,
  getSurgeryReminderStaffHtml,
  getWeeklyReportStaffHtml,
} from "@/infrastructure/email/email-templates";
import type { EmailDispatchJobPayload } from "@/infrastructure/queue/email-dispatch-job-types";
import { formatSurgeryDuration, formatSurgeryWhen } from "@/lib/utils/clinic-datetime";

export type StaffMail = { subject: string; html: string; text: string };

export type StaffMailPayload = Exclude<EmailDispatchJobPayload, { kind: "stage_transition_patient" }>;

export type StaffMailPlan = {
  targetUserIds: string[];
  /** Quando presente, só recebe e-mail quem enxerga o paciente (mesmo filtro das notificações in-app). */
  clientId: string | null;
  build: (staffName: string | null) => StaffMail;
};

/** Monta destinatários e conteúdo do e-mail por tipo de job de equipe. Puro: sem I/O. */
export function buildStaffMailPlan(payload: StaffMailPayload, base: string): StaffMailPlan {
  switch (payload.kind) {
    case "sla_alert": {
      const d = payload.data;
      const patientUrl = `${base}/dashboard/clients/${d.clientId}`;
      const label = d.severity === "danger" ? "Alerta crítico" : "Atenção";
      return {
        targetUserIds: d.targetUserIds,
        clientId: d.clientId,
        build: (staffName) => ({
          subject: `${label}: ${d.patientName} em ${d.stageName}`,
          html: getSlaAlertStaffHtml({
            staffName,
            patientName: d.patientName,
            stageName: d.stageName,
            daysInStage: d.daysInStage,
            slaThresholdDays: d.slaThresholdDays,
            clinicName: d.clinicName,
            severity: d.severity,
            patientUrl,
          }),
          text: `${label}: ${d.patientName} está há ${d.daysInStage} dia(s) na etapa "${d.stageName}". Abrir: ${patientUrl}`,
        }),
      };
    }

    case "file_pending_review_staff": {
      const d = payload.data;
      const reviewUrl = `${base}/dashboard/clients/${d.clientId}?tab=files`;
      return {
        targetUserIds: d.targetUserIds,
        clientId: d.clientId,
        build: (staffName) => ({
          subject: `Documento para revisar: ${d.fileName} (${d.patientName})`,
          html: getFilePendingReviewStaffHtml({
            staffName,
            patientName: d.patientName,
            fileName: d.fileName,
            clinicName: d.clinicName,
            reviewUrl,
          }),
          text: `${d.patientName} enviou "${d.fileName}". Revisar: ${reviewUrl}`,
        }),
      };
    }

    case "surgery_reminder_staff": {
      const d = payload.data;
      const openUrl = d.clientId ? `${base}/dashboard/clients/${d.clientId}` : `${base}/dashboard/agenda`;
      const whenLabel = formatSurgeryWhen(new Date(d.startsAtIso));
      return {
        targetUserIds: d.targetUserIds,
        clientId: d.clientId,
        build: (staffName) => ({
          subject: `Amanhã: cirurgia de ${d.patientName}, ${whenLabel}`,
          html: getSurgeryReminderStaffHtml({
            staffName,
            patientName: d.patientName,
            whenLabel,
            durationLabel: formatSurgeryDuration(d.durationMin),
            eventTitle: d.eventTitle,
            stageName: d.stageName,
            pendingRequiredItems: d.pendingRequiredItems,
            notes: d.notes,
            clinicName: d.clinicName,
            openUrl,
            openLabel: d.clientId ? "Abrir ficha do paciente" : "Abrir agenda",
          }),
          text: `Lembrete: amanhã tem cirurgia de ${d.patientName} (${whenLabel}). ${openUrl}`,
        }),
      };
    }

    case "weekly_report_staff": {
      const d = payload.data;
      const reportsUrl = `${base}/dashboard/reports`;
      return {
        targetUserIds: d.targetUserIds,
        clientId: null,
        build: (staffName) => ({
          subject: `${d.clinicName}: resumo da semana (${d.periodLabel})`,
          html: getWeeklyReportStaffHtml({
            staffName,
            clinicName: d.clinicName,
            periodLabel: d.periodLabel,
            kpis: d.kpis,
            byStatus: d.byStatus,
            topStages: d.topStages,
            critical: d.critical.map((c) => ({ ...c, url: `${base}/dashboard/clients/${c.clientId}` })),
            criticalTotal: d.criticalTotal,
            reportsUrl,
          }),
          text: `Resumo de ${d.periodLabel}: ${d.kpis.transitions} mudanças de etapa, ${d.kpis.critical} pacientes em situação crítica. ${reportsUrl}`,
        }),
      };
    }

    case "document_delivery_staff": {
      const d = payload.data;
      const patientUrl = `${base}/dashboard/clients/${d.clientId}`;
      const noChannel = !d.emailTo && !d.whatsappTo;
      return {
        targetUserIds: d.targetUserIds,
        clientId: d.clientId,
        // "Disparado", não "enviado": a entrega real é assíncrona e aparece na linha do tempo do paciente.
        build: (staffName) => ({
          subject: noChannel
            ? `Documentos não enviados: ${d.patientName} em ${d.stageName}`
            : `Documentos disparados: ${d.patientName} em ${d.stageName}`,
          html: getDocumentDeliveryStaffHtml({
            staffName,
            patientName: d.patientName,
            stageName: d.stageName,
            documents: d.documents,
            emailTo: d.emailTo,
            whatsappTo: d.whatsappTo,
            clinicName: d.clinicName,
            patientUrl,
          }),
          text: noChannel
            ? `Os documentos da etapa "${d.stageName}" não foram enviados a ${d.patientName}: sem e-mail nem WhatsApp ativo. ${patientUrl}`
            : `${d.documents.length} documento(s) da etapa "${d.stageName}" disparado(s) para ${d.patientName}. Acompanhe a entrega na ficha. ${patientUrl}`,
        }),
      };
    }

    case "checklist_complete_staff": {
      const d = payload.data;
      const patientUrl = `${base}/dashboard/clients/${d.clientId}`;
      return {
        targetUserIds: d.targetUserIds,
        clientId: d.clientId,
        build: (staffName) => ({
          subject: `Checklist completo: ${d.patientName} em ${d.stageName}`,
          html: getChecklistCompleteStaffHtml({
            staffName,
            patientName: d.patientName,
            stageName: d.stageName,
            totalRequiredItems: d.totalRequiredItems,
            clinicName: d.clinicName,
            patientUrl,
          }),
          text: `Checklist: ${d.patientName} concluiu ${d.totalRequiredItems} item(ns) obrigatório(s) em "${d.stageName}". ${patientUrl}`,
        }),
      };
    }
  }
}
