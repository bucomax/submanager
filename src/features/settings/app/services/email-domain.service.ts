import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  GetTenantEmailDomainResponseData,
  PatchTenantEmailDomainRequestBody,
  PatchTenantEmailDomainResponseData,
  PostSetupTenantEmailDomainRequestBody,
  PostSetupTenantEmailDomainResponseData,
  PostVerifyTenantEmailDomainResponseData,
} from "@/types/api/email-domain-v1";
import type { RequestOptions } from "@/types/api/request-options";

export async function getEmailDomainSettings(
  options?: RequestOptions,
): Promise<GetTenantEmailDomainResponseData> {
  const res = await apiClient.get<ApiEnvelope<GetTenantEmailDomainResponseData>>(
    "/api/v1/tenant/email-domain",
    { skipErrorToast: true, signal: options?.signal },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function postSetupEmailDomain(
  body: PostSetupTenantEmailDomainRequestBody,
): Promise<PostSetupTenantEmailDomainResponseData> {
  const res = await apiClient.post<ApiEnvelope<PostSetupTenantEmailDomainResponseData>>(
    "/api/v1/tenant/email-domain",
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function postVerifyEmailDomain(): Promise<PostVerifyTenantEmailDomainResponseData> {
  const res = await apiClient.post<ApiEnvelope<PostVerifyTenantEmailDomainResponseData>>(
    "/api/v1/tenant/email-domain/verify",
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function patchEmailDomain(
  body: PatchTenantEmailDomainRequestBody,
): Promise<PatchTenantEmailDomainResponseData> {
  const res = await apiClient.patch<ApiEnvelope<PatchTenantEmailDomainResponseData>>(
    "/api/v1/tenant/email-domain",
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function deleteEmailDomain(): Promise<GetTenantEmailDomainResponseData> {
  const res = await apiClient.delete<ApiEnvelope<GetTenantEmailDomainResponseData>>(
    "/api/v1/tenant/email-domain",
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
