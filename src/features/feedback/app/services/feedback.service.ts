import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  CreateFeedbackRequestBody,
  CreateFeedbackResponseData,
} from "@/features/feedback/app/types/api";

/** `toastSuccessMessage` é lido pelo interceptor do `apiClient` (ver `src/types/axios-augment.d.ts`). */
export async function createFeedback(
  input: CreateFeedbackRequestBody,
  toastSuccessMessage: string,
): Promise<CreateFeedbackResponseData> {
  const res = await apiClient.post<ApiEnvelope<CreateFeedbackResponseData>>(
    "/api/v1/feedback",
    input,
    { toastSuccessMessage },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
