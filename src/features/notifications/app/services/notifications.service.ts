import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  MarkAllReadResponseData,
  MarkReadResponseData,
  NotificationsListResponseData,
  UnreadCountResponseData,
} from "@/types/api/notification-v1";

export async function getNotifications(
  params?: {
    limit?: number;
    cursor?: string;
    unreadOnly?: boolean;
  },
  options?: RequestOptions,
): Promise<NotificationsListResponseData> {
  try {
    const res = await apiClient.get<ApiEnvelope<NotificationsListResponseData>>(
      "/api/v1/notifications",
      {
        params: {
          limit: params?.limit ?? 20,
          cursor: params?.cursor || undefined,
          unreadOnly: params?.unreadOnly ? "true" : undefined,
        },
        signal: options?.signal,
      },
    );
    if (!res.data.success) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getUnreadCount(options?: RequestOptions): Promise<number> {
  try {
    const res = await apiClient.get<ApiEnvelope<UnreadCountResponseData>>(
      "/api/v1/notifications/unread-count",
      { signal: options?.signal },
    );
    if (!res.data.success) throw new Error(res.data.error.message);
    return res.data.data.count;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function markNotificationRead(id: string): Promise<MarkReadResponseData> {
  try {
    const res = await apiClient.patch<ApiEnvelope<MarkReadResponseData>>(
      `/api/v1/notifications/${id}/read`,
    );
    if (!res.data.success) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function markAllRead(): Promise<MarkAllReadResponseData> {
  try {
    const res = await apiClient.post<ApiEnvelope<MarkAllReadResponseData>>(
      "/api/v1/notifications/read-all",
    );
    if (!res.data.success) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (e) {
    throw normalizeApiError(e);
  }
}
