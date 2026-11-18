import { withSessionRoute } from "@/lib/api/route-handler";
import { parseJsonBody } from "@/lib/api/parse-json-body";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import {
  feedbackReportPrismaRepository,
  isRecordNotFoundError,
} from "@/infrastructure/repositories/feedback-report.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { patchFeedbackBodySchema } from "@/lib/validators/feedback";
import type { UpdateFeedbackResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Muda status e nota de triagem de um relato (apenas `super_admin`). */
export const PATCH = withSessionRoute<{ id: string }>(async ({ request, apiT, params }) => {
  const parsed = await parseJsonBody(request, patchFeedbackBodySchema, apiT, { issues: "fields" });
  if (parsed.response) return parsed.response;

  const { id } = params;

  try {
    const row = await feedbackReportPrismaRepository.updateStatus(id, parsed.data);
    const payload: UpdateFeedbackResponseData = { feedback: toFeedbackDto(row) };
    return jsonSuccess(payload);
  } catch (err) {
    // Relato já removido ou id inválido: é 404, não falha do servidor. Sem isto o
    // P2025 escaparia como exceção não tratada e poluiria a própria fila de triagem.
    if (isRecordNotFoundError(err)) {
      return jsonError("NOT_FOUND", apiT("errors.feedbackNotFound"), 404);
    }
    throw err;
  }
}, { role: "super_admin" });
