import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  ConversationDetailResponseData,
  ConversationListQueryParams,
  ConversationsListResponseData,
  ConversationStatus,
  MessageDto,
  SendMessageRequestBody,
} from "@/types/api/contacts-v1";

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

export async function getConversationsList(
  params: ConversationListQueryParams,
): Promise<ConversationsListResponseData> {
  const search = new URLSearchParams();
  if (params.channel) search.set("channel", params.channel);
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  if (params.cursor) search.set("cursor", params.cursor);
  if (params.limit) search.set("limit", String(params.limit));

  const res = await apiClient.get<ApiEnvelope<ConversationsListResponseData>>(
    `/api/v1/tenant/conversations?${search.toString()}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function sendMessage(
  conversationId: string,
  body: SendMessageRequestBody,
): Promise<MessageDto> {
  const res = await apiClient.post<ApiEnvelope<MessageDto>>(
    `/api/v1/tenant/conversations/${conversationId}/messages`,
    body,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
