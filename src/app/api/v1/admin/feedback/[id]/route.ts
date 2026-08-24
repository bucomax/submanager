import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { getApiT } from "@/lib/api/i18n";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { formatZodIssues } from "@/lib/api/zod-error";
import { requireSessionOr401, superAdminOr403 } from "@/lib/auth/guards";
import { patchFeedbackBodySchema } from "@/lib/validators/feedback";
import type { UpdateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Muda status e nota de triagem de um relato (apenas `super_admin`). */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const apiT = await getApiT(request);
  const auth = await requireSessionOr401(request, apiT);
  if (auth.response) return auth.response;

  const forbidden = await superAdminOr403(auth.session!, request, apiT);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("INVALID_JSON", apiT("errors.invalidJson"), 400);
  }

  const parsed = patchFeedbackBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { id } = await context.params;
  const row = await feedbackReportPrismaRepository.updateStatus(id, parsed.data);

  const payload: UpdateFeedbackResponseData = { feedback: toFeedbackDto(row) };
  return jsonSuccess(payload);
}
