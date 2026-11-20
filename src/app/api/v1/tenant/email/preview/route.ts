import { withTenantRoute } from "@/lib/api/route-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import {
  getChecklistCompleteStaffHtml,
  getDocumentDeliveryStaffHtml,
  getFilePendingReviewStaffHtml,
  getSlaAlertStaffHtml,
  getStageTransitionPatientHtml,
  getSurgeryReminderStaffHtml,
  getWeeklyReportStaffHtml,
} from "@/infrastructure/email/email-templates";
import { tenantPrismaRepository } from "@/infrastructure/repositories/tenant.repository";
import { getPublicAppUrl } from "@/lib/config/urls";
import {
  type EmailPreviewKind,
  EMAIL_PREVIEW_KINDS,
} from "@/features/settings/app/services/tenant-email-preview.service";

const kindSchema = z.enum(
  EMAIL_PREVIEW_KINDS as unknown as [string, ...string[]],
);

export const dynamic = "force-dynamic";

/**
 * Pré-visualização HTML dos templates transacionais (dados fictícios, nome da clínica do tenant).
 * Autenticado, membro ativo do tenant. Uso: iframe no modal de ajuda em Configurações → E-mail.
 */
export const GET = withTenantRoute(async ({ request, tenantId, apiT }) => {
  const url = new URL(request.url);
  const parsed = kindSchema.safeParse(url.searchParams.get("kind") ?? "stage_transition");
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", apiT("errors.emailPreviewInvalidKind"), 422);
  }
  const kind = parsed.data as EmailPreviewKind;

  const row = await tenantPrismaRepository.findTenantNameAndSlugById(tenantId);
  const clinicName = row?.name?.trim() || "Sua clínica";
  const base = getPublicAppUrl().replace(/\/$/, "");
  const slug = row?.slug?.trim() || "clinica";
  const portalUrl = `${base}/${encodeURIComponent(slug)}/patient/login`;
  const demoClientPath = `${base}/dashboard/clients/preview-exemplo`;

  let html: string;
  switch (kind) {
    case "stage_transition":
      html = getStageTransitionPatientHtml({
        patientName: "Maria Exemplo",
        clinicName,
        stageName: "Pré-operatório",
        patientMessage: "Confira o material e as orientações desta fase.",
        documents: [{ fileName: "orientacoes_pre_operatorio.pdf" }],
        portalUrl,
      });
      break;
    case "sla_alert":
      html = getSlaAlertStaffHtml({
        staffName: "Dra. Exemplo",
        patientName: "Maria Exemplo",
        stageName: "Acompanhamento",
        daysInStage: 5,
        slaThresholdDays: 3,
        clinicName,
        severity: "warning",
        patientUrl: demoClientPath,
      });
      break;
    case "file_pending_review":
      html = getFilePendingReviewStaffHtml({
        staffName: "Dra. Exemplo",
        patientName: "Maria Exemplo",
        fileName: "exame_laboratorial.pdf",
        clinicName,
        reviewUrl: `${demoClientPath}?tab=files`,
      });
      break;
    case "checklist_complete":
      html = getChecklistCompleteStaffHtml({
        staffName: "Dra. Exemplo",
        patientName: "Maria Exemplo",
        stageName: "Triagem",
        totalRequiredItems: 3,
        clinicName,
        patientUrl: demoClientPath,
      });
      break;
    case "surgery_reminder":
      html = getSurgeryReminderStaffHtml({
        staffName: "Dra. Exemplo",
        patientName: "Maria Exemplo",
        whenLabel: "quinta, 19/11 às 7h30",
        durationLabel: "3 h",
        eventTitle: "Cirurgia ortognática",
        stageName: "Cirurgia agendada",
        pendingRequiredItems: 1,
        notes: "Jejum desde 22h. Levar exames de imagem.",
        clinicName,
        openUrl: demoClientPath,
        openLabel: "Abrir ficha do paciente",
      });
      break;
    case "weekly_report":
      html = getWeeklyReportStaffHtml({
        staffName: "Dra. Exemplo",
        clinicName,
        periodLabel: "10 a 16 de novembro",
        kpis: { patients: 42, transitions: 17, critical: 3, pathways: 2 },
        byStatus: { ok: 31, warning: 8, danger: 3 },
        topStages: [
          { label: "Exames pré-operatórios", count: 12 },
          { label: "Planejamento", count: 9 },
          { label: "Pós-operatório", count: 7 },
        ],
        critical: [
          { name: "Maria Exemplo", stageName: "Autorização do convênio", daysInStage: 14, url: demoClientPath },
          { name: "João Exemplo", stageName: "Exames pré-operatórios", daysInStage: 11, url: demoClientPath },
        ],
        criticalTotal: 3,
        reportsUrl: `${base}/dashboard/reports`,
      });
      break;
    case "document_delivery":
      html = getDocumentDeliveryStaffHtml({
        staffName: "Dra. Exemplo",
        patientName: "Maria Exemplo",
        stageName: "Pré-operatório",
        documents: ["orientacoes_pre_operatorio.pdf", "lista_de_exames.pdf"],
        emailTo: "m***@exemplo.com",
        whatsappTo: "****-4410",
        clinicName,
        patientUrl: demoClientPath,
      });
      break;
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
});
