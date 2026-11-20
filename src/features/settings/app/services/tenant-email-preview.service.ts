/**
 * Pré-visualização HTML do template de e-mail (GET autenticado).
 * Não dispara envio; usado p.ex. no iframe do modal "E-mails transacionais".
 */
export const TENANT_EMAIL_PREVIEW_PATH = "/api/v1/tenant/email/preview" as const;

export const EMAIL_PREVIEW_KINDS = [
  "stage_transition",
  "sla_alert",
  "file_pending_review",
  "checklist_complete",
  "surgery_reminder",
  "weekly_report",
  "document_delivery",
] as const;

export type EmailPreviewKind = (typeof EMAIL_PREVIEW_KINDS)[number];

export function getTenantEmailPreviewPath(kind: EmailPreviewKind): string {
  return `${TENANT_EMAIL_PREVIEW_PATH}?kind=${encodeURIComponent(kind)}`;
}
