import { apiClient } from "@/lib/api/http-client";
import { notifyActiveAppsMenuInvalidated } from "@/features/apps/app/lib/invalidate-active-apps";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  AdminAppDetailResponseData,
  AdminAppsListResponseData,
  CreateAppRequestBody,
  UpdateAppRequestBody,
  AppDto,
} from "@/types/api/apps-v1";

/** Lista todos os apps (admin). */
export async function getAdminApps(): Promise<AppDto[]> {
  const res = await apiClient.get<ApiEnvelope<AdminAppsListResponseData>>(
    "/api/v1/admin/apps",
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data.apps;
}

/** Criar novo app (admin). */
export async function createApp(data: CreateAppRequestBody): Promise<AppDto> {
  const res = await apiClient.post<ApiEnvelope<AdminAppDetailResponseData>>(
    "/api/v1/admin/apps",
    data,
    { toastSuccessMessage: "App criado com sucesso." },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data.app;
}

/** Atualizar app (admin). */
export async function updateApp(appId: string, data: UpdateAppRequestBody): Promise<AppDto> {
  const res = await apiClient.patch<ApiEnvelope<AdminAppDetailResponseData>>(
    `/api/v1/admin/apps/${appId}`,
    data,
    { toastSuccessMessage: "App atualizado." },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  return res.data.data.app;
}

/** Publicar/despublicar app (admin). */
export async function publishApp(appId: string, isPublished: boolean): Promise<AppDto> {
  const res = await apiClient.patch<ApiEnvelope<AdminAppDetailResponseData>>(
    `/api/v1/admin/apps/${appId}`,
    { isPublished },
    { toastSuccessMessage: isPublished ? "App publicado." : "App despublicado." },
  );
  if (!res.data.success) throw new Error(res.data.error.message);
  notifyActiveAppsMenuInvalidated();
  return res.data.data.app;
}

/** Excluir app (admin). */
export async function deleteApp(appId: string): Promise<void> {
  await apiClient.delete(`/api/v1/admin/apps/${appId}`, {
    toastSuccessMessage: "App excluído.",
  });
}
