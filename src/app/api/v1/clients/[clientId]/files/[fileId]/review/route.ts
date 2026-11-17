import { formatZodIssues } from "@/lib/api/zod-error";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { runReviewClientPortalFile } from "@/application/use-cases/client/review-client-portal-file";
import { findTenantClientVisibleToSession } from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  assertActiveTenantMembership,
  getActiveTenantIdOr400,
  requireSessionOr401,
} from "@/lib/auth/guards";
import { notifyPatientFileReviewed } from "@/infrastructure/email/notify-patient-file-reviewed";
import { emitFileReviewDecidedStaffNotification } from "@/infrastructure/notifications/emit-file-review-staff-notice";
import { patchClientFileReviewBodySchema } from "@/lib/validators/patient-portal-files";
import type { RouteCtx } from "@/types/api/route-context";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: RouteCtx) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const tenantCtx = await getActiveTenantIdOr400(auth.session!, request, apiT);
  if (tenantCtx.response) return tenantCtx.response;
  const forbidden = await assertActiveTenantMembership(auth.session!, tenantCtx.tenantId, request, apiT);
  if (forbidden) return forbidden;

  const { clientId, fileId } = await ctx.params;
  const { tenantId } = tenantCtx;
  const userId = auth.session!.user.id;

  const client = await findTenantClientVisibleToSession(auth.session!, tenantId, clientId, {
    id: true,
    name: true,
  });
  if (!client) {
    return jsonError("NOT_FOUND", apiT("errors.patientNotFound"), 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchClientFileReviewBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

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
    if (result.code === "FILE_NOT_FOUND") {
      return jsonError("NOT_FOUND", apiT("errors.clientFileNotFound"), 404);
    }
    return jsonError("INVALID_STATE", apiT("errors.fileNotPendingPortalReview"), 409);
  }

  notifyPatientFileReviewed({
    tenantId,
    clientId,
    fileName: result.fileName,
    decision: parsed.data.decision,
    rejectReason: parsed.data.decision === "reject" ? parsed.data.rejectReason : undefined,
  }).catch((err) => console.error("[file-review] notify patient failed:", err));

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
  }).catch((err) => console.error("[file-review] staff notification failed:", err));

  return jsonSuccess({
    fileId: result.fileId,
    patientPortalReviewStatus: result.patientPortalReviewStatus,
  });
}
