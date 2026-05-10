import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";

type SetInviteePasswordInput = {
  userId: string;
  tenantId: string;
  password: string;
};

type SetInviteePasswordResponseData = {
  userId: string;
};

export async function setInviteePassword(
  input: SetInviteePasswordInput,
): Promise<SetInviteePasswordResponseData> {
  const res = await apiClient.post<ApiEnvelope<SetInviteePasswordResponseData>>(
    "/api/v1/admin/invites/set-password",
    input,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
