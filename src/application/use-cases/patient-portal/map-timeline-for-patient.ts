import type {
  ClientTimelineAuditEventType,
  ClientTimelineItemDto,
  ClientTimelineResponseData,
} from "@/types/api/clients-v1";
import type { PatientPortalTimelineItemDto, PatientPortalTimelineResponseData } from "@/types/api/patient-portal-v1";

function sanitizeAuditPayloadForPatient(
  type: ClientTimelineAuditEventType,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  switch (type) {
    case "STAGE_TRANSITION": {
      const copy = { ...payload };
      delete copy.ruleOverrideReason;
      delete copy.forcedOverride;
      return copy;
    }
    case "FILE_UPLOADED_TO_CLIENT":
    case "PATIENT_PORTAL_FILE_SUBMITTED":
    case "PATIENT_PORTAL_FILE_APPROVED":
    case "PATIENT_PORTAL_FILE_REJECTED":
      return {
        ...(typeof payload.fileAssetId === "string" ? { fileAssetId: payload.fileAssetId } : {}),
        ...(typeof payload.mimeType === "string" ? { mimeType: payload.mimeType } : {}),
      };
    case "SELF_REGISTER_COMPLETED":
      return {
        ...(typeof payload.mode === "string" ? { mode: payload.mode } : {}),
      };
    case "PATIENT_CONSENT_GIVEN":
      return {
        ...(typeof payload.consentType === "string" ? { consentType: payload.consentType } : {}),
        ...(typeof payload.version === "string" ? { version: payload.version } : {}),
      };
    case "WHATSAPP_DISPATCH_QUEUED":
    case "WHATSAPP_DISPATCH_SENT":
    case "WHATSAPP_DISPATCH_DELIVERED":
    case "WHATSAPP_DISPATCH_READ":
    case "WHATSAPP_DISPATCH_FAILED":
    case "WHATSAPP_PATIENT_CONFIRMED":
      return {
        ...(typeof payload.channelDispatchId === "string"
          ? { channelDispatchId: payload.channelDispatchId }
          : {}),
        ...(typeof payload.documentFileName === "string"
          ? { documentFileName: payload.documentFileName }
          : {}),
        ...(typeof payload.stageTransitionId === "string"
          ? { stageTransitionId: payload.stageTransitionId }
          : {}),
      };
    case "TENANT_EMAIL_DOMAIN_CONFIGURED":
    case "TENANT_EMAIL_DOMAIN_REMOVED":
    case "SUPER_ADMIN_TENANT_ENTERED":
      return {};
    default:
      return {};
  }
}

function mapAuditItem(item: Extract<ClientTimelineItemDto, { kind: "audit" }>): PatientPortalTimelineItemDto {
  return {
    kind: "audit",
    id: item.id,
    type: item.type,
    category: item.category,
    createdAt: item.createdAt,
    actorName: item.actor?.name ?? null,
    payload: sanitizeAuditPayloadForPatient(item.type, item.payload),
  };
}

function mapLegacyItem(
  item: Extract<ClientTimelineItemDto, { kind: "legacy_transition" }>,
): PatientPortalTimelineItemDto {
  return {
    kind: "legacy_transition",
    id: item.id,
    category: item.category,
    createdAt: item.createdAt,
    fromStage: item.fromStage ? { name: item.fromStage.name } : null,
    toStage: { name: item.toStage.name },
  };
}

/** Remove e-mails, notas clínicas e metadados internos desnecessários para o paciente. */
export function mapClientTimelineForPatientPortal(
  data: ClientTimelineResponseData,
): PatientPortalTimelineResponseData {
  const items: PatientPortalTimelineItemDto[] = data.items.map((item) =>
    item.kind === "audit" ? mapAuditItem(item) : mapLegacyItem(item),
  );
  return {
    items,
    pagination: data.pagination,
    timelineCapped: data.timelineCapped,
  };
}
