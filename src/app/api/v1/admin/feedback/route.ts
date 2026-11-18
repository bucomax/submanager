import { withSessionRoute } from "@/lib/api/route-handler";
import { toFeedbackDto } from "@/app/api/v1/feedback/to-feedback-dto";
import { feedbackReportPrismaRepository } from "@/infrastructure/repositories/feedback-report.repository";
import { jsonError, jsonSuccess } from "@/lib/api-response";
import { buildPagination } from "@/lib/api/pagination";
import { formatZodIssues } from "@/lib/api/zod-error";
import { listFeedbackQuerySchema } from "@/lib/validators/feedback";
import type { FeedbackListResponseData } from "@/types/api/feedback-v1";

export const dynamic = "force-dynamic";

/** Fila de triagem de feedback, cross-tenant (apenas `super_admin`). */
export const GET = withSessionRoute(async ({ request }) => {
  const url = new URL(request.url);
  const parsed = listFeedbackQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", formatZodIssues(parsed.error), 422);
  }

  const { rows, totalItems } = await feedbackReportPrismaRepository.listForSuperAdmin(
    parsed.data,
  );

  const payload: FeedbackListResponseData = {
    data: rows.map(toFeedbackDto),
    pagination: buildPagination(parsed.data.page, parsed.data.limit, totalItems),
  };
  return jsonSuccess(payload);
}, { role: "super_admin" });
