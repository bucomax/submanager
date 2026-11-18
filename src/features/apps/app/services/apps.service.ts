import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  ActiveAppDto,
  AppCatalogResponseData,
  AppDetailResponseData,
  TenantActiveAppsResponseData,
} from "@/types/api/apps-v1";

/** Catálogo de apps publicados com status do tenant. */
export async function getAppCatalog(
  params?: { category?: string; search?: string },
  options?: RequestOptions,
): Promise<AppCatalogResponseData> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.search) search.set("search", params.search);
  const qs = search.toString();

  const res = await apiClient.get<ApiEnvelope<AppCatalogResponseData>>(
    `/api/v1/tenant/apps${qs ? `?${qs}` : ""}`,
    { signal: options?.signal },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}

/** Detalhe do app com status do tenant. */
export async function getAppDetail(
  appId: string,
  options?: RequestOptions,
): Promise<AppDetailResponseData> {
  const res = await apiClient.get<ApiEnvelope<AppDetailResponseData>>(
    `/api/v1/tenant/apps/${appId}`,
    { signal: options?.signal },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}

/** Apps ativos do tenant (para sidebar). */
export async function getActiveApps(options?: RequestOptions): Promise<ActiveAppDto[]> {
  const res = await apiClient.get<ApiEnvelope<TenantActiveAppsResponseData>>(
    "/api/v1/tenant/apps/active",
    { skipErrorToast: true, signal: options?.signal },
  );
  if (!res.data.success) return [];
  return res.data.data.apps;
}

/** Ativar app no tenant. */
export async function activateApp(
  appId: string,
  config?: Record<string, unknown>,
): Promise<void> {
  await apiClient.post(`/api/v1/tenant/apps/${appId}`, { config }, {
    toastSuccessMessage: "App ativado com sucesso.",
  });
}

/** Desativar app no tenant. */
export async function deactivateApp(appId: string): Promise<void> {
  await apiClient.delete(`/api/v1/tenant/apps/${appId}`, {
    toastSuccessMessage: "App desativado.",
  });
}

/** Gerar token scoped para iframe app. */
export async function getAppScopedToken(
  appId: string,
): Promise<{ token: string; expiresIn: number }> {
  const res = await apiClient.post<
    ApiEnvelope<{ token: string; expiresIn: number }>
  >(`/api/v1/tenant/apps/${appId}/token`, {}, { skipErrorToast: true });
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data;
}
