import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";

import type { MeUser } from "@/features/settings/app/types/account";
import type { RequestOptions } from "@/types/api/request-options";

type GetMePayload = { user: MeUser };

type PatchMePayload = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    imageUrl: string | null;
    globalRole: string;
    /** ISO string — JSON não deserializa como `Date`. */
    emailVerified: string | null;
  };
};

export async function getMe(options?: RequestOptions): Promise<MeUser> {
  try {
    const res = await apiClient.get<ApiEnvelope<GetMePayload>>("/api/v1/me", {
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.user;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function patchMe(body: { name?: string; image?: string | null }): Promise<PatchMePayload["user"]> {
  try {
    const res = await apiClient.patch<ApiEnvelope<PatchMePayload>>("/api/v1/me", body);
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.user;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function changePassword(body: { currentPassword: string; newPassword: string }): Promise<void> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ message: string }>>("/api/v1/me/password", body);
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function deleteAccount(): Promise<void> {
  try {
    const res = await apiClient.delete<ApiEnvelope<{ message: string }>>("/api/v1/me", {
      skipErrorToast: true,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}
