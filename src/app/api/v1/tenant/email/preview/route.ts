import { withTenantRoute } from "@/lib/api/route-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-response";
import {
  getChecklistCompleteStaffHtml,
  getFilePendingReviewStaffHtml,
  getSlaAlertStaffHtml,
  getStageTransitionPatientHtml,
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
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });
});
