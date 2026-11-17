import type { ClientTimelineEventCategory } from "@/types/api/clients-v1";

export const CLIENT_TIMELINE_EVENT_CATEGORIES: readonly ClientTimelineEventCategory[] = [
  "security",
  "clinical",
  "documents",
  "administrative",
  "compliance",
];

export function auditEventTypeToCategory(type: string): ClientTimelineEventCategory {
  switch (type) {
    case "STAGE_TRANSITION":
    case "PATIENT_PATHWAY_STARTED":
    case "PATIENT_PATHWAY_COMPLETED":
    case "CHECKLIST_ITEM_TOGGLED":
    case "WHATSAPP_DISPATCH_QUEUED":
    case "WHATSAPP_DISPATCH_SENT":
    case "WHATSAPP_DISPATCH_DELIVERED":
    case "WHATSAPP_DISPATCH_READ":
    case "WHATSAPP_DISPATCH_FAILED":
    case "WHATSAPP_PATIENT_CONFIRMED":
      return "clinical";

    case "FILE_UPLOADED_TO_CLIENT":
    case "PATIENT_PORTAL_FILE_SUBMITTED":
    case "PATIENT_PORTAL_FILE_APPROVED":
    case "PATIENT_PORTAL_FILE_REJECTED":
    case "FILE_DOWNLOADED_BY_STAFF":
    case "FILE_DOWNLOADED_BY_PATIENT":
    case "FILE_DELETED":
      return "documents";

    case "PATIENT_CREATED":
    case "PATIENT_UPDATED":
    case "PATIENT_DELETED":
    case "SELF_REGISTER_COMPLETED":
      return "administrative";

    case "PATIENT_CONSENT_GIVEN":
      return "compliance";

    case "PATIENT_PORTAL_SESSION_CREATED":
    case "PATIENT_PORTAL_PASSWORD_SET":
    case "PATIENT_PORTAL_LINK_GENERATED":
    case "PATIENT_PORTAL_LOGIN_FAILED":
    case "SUPER_ADMIN_TENANT_ENTERED":
    case "TENANT_MEMBER_ADDED":
      return "security";

    case "AUDIT_EXPORT_GENERATED":
    case "STAFF_LOGIN_SUCCESS":
    case "STAFF_LOGIN_FAILED":
    case "STAFF_PASSWORD_CHANGED":
    case "STAFF_PASSWORD_RESET":
    default:
      return "administrative";
  }
}
