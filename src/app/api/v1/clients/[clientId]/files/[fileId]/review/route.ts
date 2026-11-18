import { logger } from "@/lib/observability/logger";
import { actorFromSession } from "@/lib/auth/actor";
import { withTenantRoute } from "@/lib/api/route-handler";
import { mapUseCaseError } from "@/lib/api/map-use-case-error";
import { CLIENT_FILE_REVIEW_ERRORS } from "@/lib/api/error-tables/client";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runReviewClientPortalFile } from "@/application/use-cases/client/review-client-portal-file";
import { findTenantClientVisibleToActor } from "@/application/use-cases/shared/load-client-visibility-scope";
import { notifyPatientFileReviewed } from "@/infrastructure/email/notify-patient-file-reviewed";
import { emitFileReviewDecidedStaffNotification } from "@/infrastructure/notifications/emit-file-review-staff-notice";
import { patchClientFileReviewBodySchema } from "@/lib/validators/patient-portal-files";

export const dynamic = "force-dynamic";

export const PATCH = withTenantRoute(async ({ request, session, tenantId, apiT, params }) => {
  const { clientId, fileId } = params;
  const userId = session.user.id;

  const client = await findTenantClientVisibleToActor(actorFromSession(session), tenantId, clientId, {
    id: true,
    name: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  const parsed = await parseJsonBody(request, patchClientFileReviewBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const result = await runReviewClientPortalFile({
    tenantId,
    clientId,
    fileId,
    actorUserId: userId,
    input: {
      decision: parsed.data.decision,
      rejectReason: parsed.data.rejectReason,
    },
  });

  if (!result.ok) {
    return mapUseCaseError(result.code, CLIENT_FILE_REVIEW_ERRORS, apiT);
  }

  notifyPatientFileReviewed({
    tenantId,
    clientId,
    fileName: result.fileName,
    decision: parsed.data.decision,
    rejectReason: parsed.data.decision === "reject" ? parsed.data.rejectReason : undefined,
  }).catch((err) => logger.error("[file-review] notify patient failed", { err }));

  const clientName = client.name?.trim() || "Paciente";
  emitFileReviewDecidedStaffNotification({
    tenantId,
    clientId,
    clientName,
    fileId: result.fileId,
    fileName: result.fileName,
    decision: parsed.data.decision,
    rejectReason: parsed.data.decision === "reject" ? parsed.data.rejectReason : undefined,
    actorUserId: userId,
  }).catch((err) => logger.error("[file-review] staff notification failed", { err }));

  return jsonSuccess({
    fileId: result.fileId,
    patientPortalReviewStatus: result.patientPortalReviewStatus,
  });
});
