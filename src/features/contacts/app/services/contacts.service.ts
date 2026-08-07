import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  ConversationDetailResponseData,
  ConversationsBoardResponseData,
  ConversationStatus,
} from "@/types/api/contacts-v1";

export async function getConversationsBoard(): Promise<ConversationsBoardResponseData> {
  const res = await apiClient.get<ApiEnvelope<ConversationsBoardResponseData>>(
    "/api/v1/tenant/conversations",
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<void> {
  const res = await apiClient.patch<ApiEnvelope<{ id: string; status: ConversationStatus }>>(
    `/api/v1/tenant/conversations/${conversationId}`,
    { status },
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}

export async function getConversationDetail(
  conversationId: string,
): Promise<ConversationDetailResponseData> {
  const res = await apiClient.get<ApiEnvelope<ConversationDetailResponseData>>(
    `/api/v1/tenant/conversations/${conversationId}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
