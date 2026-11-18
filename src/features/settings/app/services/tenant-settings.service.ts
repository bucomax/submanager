import type { AxiosRequestConfig } from "axios";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  CreateOpmeSupplierResponseData,
  GetTenantNotificationSettingsResponseData,
  GetTenantClinicSettingsResponseData,
  GetWhatsAppSettingsResponseData,
  ListOpmeSuppliersQueryParams,
  OpmeSuppliersListResponseData,
  TenantMembersListResponseData,
  UpdateTenantClinicSettingsRequestBody,
  UpdateTenantClinicSettingsResponseData,
  UpdateTenantNotificationSettingsRequestBody,
  UpdateTenantNotificationSettingsResponseData,
  UpdateWhatsAppSettingsRequestBody,
  UpdateWhatsAppSettingsResponseData,
} from "@/types/api/tenant-settings-v1";

export async function listTenantMembersForPicker(
  requestConfig?: Pick<AxiosRequestConfig, "skipErrorToast" | "signal">,
): Promise<TenantMembersListResponseData> {
  const res = await apiClient.get<ApiEnvelope<TenantMembersListResponseData>>("/api/v1/tenant/members", {
    ...requestConfig,
    skipErrorToast: requestConfig?.skipErrorToast ?? true,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function getTenantClinicSettings(
  requestConfig?: Pick<AxiosRequestConfig, "skipErrorToast" | "signal">,
): Promise<GetTenantClinicSettingsResponseData> {
  const res = await apiClient.get<ApiEnvelope<GetTenantClinicSettingsResponseData>>("/api/v1/tenant", requestConfig);
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateTenantClinicSettings(
  body: UpdateTenantClinicSettingsRequestBody,
): Promise<UpdateTenantClinicSettingsResponseData> {
  const res = await apiClient.patch<ApiEnvelope<UpdateTenantClinicSettingsResponseData>>(
    "/api/v1/tenant",
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function getTenantNotificationSettings(
  options?: RequestOptions,
): Promise<GetTenantNotificationSettingsResponseData> {
  const res =
    await apiClient.get<ApiEnvelope<GetTenantNotificationSettingsResponseData>>(
      "/api/v1/tenant/notifications",
      { signal: options?.signal },
    );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateTenantNotificationSettings(
  body: UpdateTenantNotificationSettingsRequestBody,
): Promise<UpdateTenantNotificationSettingsResponseData> {
  const res =
    await apiClient.patch<ApiEnvelope<UpdateTenantNotificationSettingsResponseData>>(
      "/api/v1/tenant/notifications",
      body,
    );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function listOpmeSuppliers(
  params?: ListOpmeSuppliersQueryParams,
  options?: RequestOptions,
): Promise<OpmeSuppliersListResponseData> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.includeInactive) search.set("includeInactive", "1");
  const qs = search.toString();
  const url = qs ? `/api/v1/opme-suppliers?${qs}` : "/api/v1/opme-suppliers";
  const res = await apiClient.get<ApiEnvelope<OpmeSuppliersListResponseData>>(url, {
    signal: options?.signal,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function createOpmeSupplier(name: string): Promise<CreateOpmeSupplierResponseData> {
  const res = await apiClient.post<ApiEnvelope<CreateOpmeSupplierResponseData>>(
    "/api/v1/opme-suppliers",
    { name },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

// ---------------------------------------------------------------------------
// WhatsApp Business API Settings
// ---------------------------------------------------------------------------

export async function getWhatsAppSettings(
  options?: RequestOptions,
): Promise<GetWhatsAppSettingsResponseData> {
  const res = await apiClient.get<ApiEnvelope<GetWhatsAppSettingsResponseData>>(
    "/api/v1/tenant/whatsapp",
    { skipErrorToast: true, signal: options?.signal },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateWhatsAppSettings(
  body: UpdateWhatsAppSettingsRequestBody,
): Promise<UpdateWhatsAppSettingsResponseData> {
  const res = await apiClient.patch<ApiEnvelope<UpdateWhatsAppSettingsResponseData>>(
    "/api/v1/tenant/whatsapp",
    body,
    { toastSuccessMessage: "Configurações do WhatsApp salvas." },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function testWhatsAppConnection(): Promise<{ ok: boolean }> {
  const res = await apiClient.post<ApiEnvelope<{ ok: boolean }>>(
    "/api/v1/tenant/whatsapp/test",
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
