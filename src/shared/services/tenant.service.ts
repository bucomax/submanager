import { clearQueryCache } from "@/shared/lib/query/query-client";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type { TenantListItem } from "@/shared/types/tenant";

type TenantsPayload = { tenants: TenantListItem[] };

type ContextPayload = {
  tenantId: string;
  tenantRole: string | null;
  user?: {
    id: string;
    email: string | null;
    globalRole: string;
    tenantId?: string | null;
    tenantRole?: string | null;
  };
};

export async function listTenants(options?: RequestOptions): Promise<TenantListItem[]> {
  const res = await apiClient.get<ApiEnvelope<TenantsPayload>>("/api/v1/tenants", {
    signal: options?.signal,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.tenants;
}

export async function setActiveTenant(tenantId: string): Promise<ContextPayload> {
  const res = await apiClient.post<ApiEnvelope<ContextPayload>>("/api/v1/auth/context", {
    tenantId,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  // Dados em cache pertencem ao tenant anterior.
  clearQueryCache();
  return res.data.data;
}
