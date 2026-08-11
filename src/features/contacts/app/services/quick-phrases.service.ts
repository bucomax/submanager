import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { QuickPhraseDto, QuickPhrasesResponseData, UpsertQuickPhraseRequestBody } from "@/types/api/contacts-v1";

export async function listQuickPhrases(): Promise<QuickPhraseDto[]> {
  const res = await apiClient.get<ApiEnvelope<QuickPhrasesResponseData>>(
    "/api/v1/tenant/quick-phrases",
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.data;
}

export async function createQuickPhrase(
  input: UpsertQuickPhraseRequestBody,
): Promise<QuickPhraseDto> {
  const res = await apiClient.post<ApiEnvelope<QuickPhraseDto>>(
    "/api/v1/tenant/quick-phrases",
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateQuickPhrase(
  id: string,
  input: Partial<UpsertQuickPhraseRequestBody>,
): Promise<QuickPhraseDto> {
  const res = await apiClient.patch<ApiEnvelope<QuickPhraseDto>>(
    `/api/v1/tenant/quick-phrases/${id}`,
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function deleteQuickPhrase(id: string): Promise<void> {
  const res = await apiClient.delete<ApiEnvelope<{ id: string }>>(
    `/api/v1/tenant/quick-phrases/${id}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}
