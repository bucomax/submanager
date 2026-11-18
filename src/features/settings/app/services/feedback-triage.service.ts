import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  FeedbackListResponseData,
  ListFeedbackQueryParams,
  UpdateFeedbackRequestBody,
  UpdateFeedbackResponseData,
} from "@/types/api/feedback-v1";
import type { RequestOptions } from "@/types/api/request-options";

/** Lista relatos de feedback cross-tenant (apenas `super_admin`). */
export async function listFeedback(
  params: ListFeedbackQueryParams,
  options?: RequestOptions,
): Promise<FeedbackListResponseData> {
  const res = await apiClient.get<ApiEnvelope<FeedbackListResponseData>>(
    "/api/v1/admin/feedback",
    { params, signal: options?.signal },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}

/** Atualiza status/nota de triagem de um relato. */
export async function updateFeedback(
  id: string,
  input: UpdateFeedbackRequestBody,
): Promise<UpdateFeedbackResponseData> {
  const res = await apiClient.patch<ApiEnvelope<UpdateFeedbackResponseData>>(
    `/api/v1/admin/feedback/${id}`,
    input,
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}
