import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  CreateAdminTenantRequestBody,
  CreateAdminTenantResponseData,
  ListAdminTenantsResponseData,
  PatchAdminTenantRequestBody,
  PatchAdminTenantResponseData,
} from "@/types/api/admin-tenants-v1";
import type { RequestOptions } from "@/types/api/request-options";

export async function listAdminTenants(options?: RequestOptions): Promise<ListAdminTenantsResponseData> {
  const res = await apiClient.get<ApiEnvelope<ListAdminTenantsResponseData>>("/api/v1/admin/tenants", {
    signal: options?.signal,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function patchAdminTenant(
  tenantId: string,
  body: PatchAdminTenantRequestBody,
): Promise<PatchAdminTenantResponseData> {
  const res = await apiClient.patch<ApiEnvelope<PatchAdminTenantResponseData>>(
    `/api/v1/admin/tenants/${tenantId}`,
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function createAdminTenant(
  body: CreateAdminTenantRequestBody,
): Promise<CreateAdminTenantResponseData> {
  const res = await apiClient.post<ApiEnvelope<CreateAdminTenantResponseData>>(
    "/api/v1/admin/tenants",
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
