import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";

import type { TenantMemberRow, TenantRole } from "@/features/settings/app/types/account";
import type { RequestOptions } from "@/types/api/request-options";

type ListPayload = { members: TenantMemberRow[] };

export async function listTenantMembers(
  tenantId: string,
  options?: RequestOptions,
): Promise<TenantMemberRow[]> {
  try {
    const res = await apiClient.get<ApiEnvelope<ListPayload>>(`/api/v1/admin/tenants/${tenantId}/members`, {
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.members;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function patchMemberRole(
  tenantId: string,
  userId: string,
  role: TenantRole,
): Promise<void> {
  try {
    const res = await apiClient.patch<ApiEnvelope<{ member: { userId: string; tenantId: string; role: string } }>>(
      `/api/v1/admin/tenants/${tenantId}/members/${userId}`,
      { role },
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function removeTenantMember(tenantId: string, userId: string): Promise<void> {
  try {
    const res = await apiClient.delete<ApiEnvelope<{ message: string }>>(
      `/api/v1/admin/tenants/${tenantId}/members/${userId}`,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}
