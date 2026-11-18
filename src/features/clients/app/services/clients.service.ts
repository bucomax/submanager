import { apiClient } from "@/lib/api/http-client";
import type {
  ClientDetailQueryParams,
  ClientDetailResponseData,
  ClientTimelineQueryParams,
  ClientTimelineResponseData,
  ClientDto,
  ClientsListResponseData,
  CreateClientRequestBody,
  CreateClientResponseData,
  CreatePatientPathwayRequestBody,
  CreatePatientPathwayResponseData,
  CreatePatientSelfRegisterInviteRequestBody,
  CreatePatientSelfRegisterInviteResponseData,
  ListClientsQueryParams,
  PatchClientRequestBody,
  PathwaysListResponseData,
  PatientPathwayCreated,
  PublishedPathwayStagesResponseData,
  PublishedStageRowDto,
  PathwayOption,
  UpdateClientResponseData,
} from "@/types/api/clients-v1";
import type { PostClientPortalLinkResponse } from "@/types/api/patient-portal-v1";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  ClientFilesListQueryParams,
  ClientFilesListResponseData,
  FileDownloadPresignRequestBody,
  FileDownloadPresignResponseData,
  PatientPortalFileReviewStatusDto,
} from "@/types/api/files-v1";

export async function getClientDetail(
  clientId: string,
  params?: ClientDetailQueryParams,
  options?: RequestOptions,
): Promise<ClientDetailResponseData> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  const url = qs ? `/api/v1/clients/${clientId}?${qs}` : `/api/v1/clients/${clientId}`;
  const res = await apiClient.get<ApiEnvelope<ClientDetailResponseData>>(url, { signal: options?.signal });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function getClientTimeline(
  clientId: string,
  params?: ClientTimelineQueryParams,
  options?: RequestOptions,
): Promise<ClientTimelineResponseData> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.categories?.trim()) search.set("categories", params.categories.trim());
  const qs = search.toString();
  const url = qs
    ? `/api/v1/clients/${clientId}/timeline?${qs}`
    : `/api/v1/clients/${clientId}/timeline`;
  const res = await apiClient.get<ApiEnvelope<ClientTimelineResponseData>>(url, { signal: options?.signal });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function listClients(
  params?: ListClientsQueryParams,
  options?: RequestOptions,
): Promise<ClientsListResponseData> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.q?.trim()) search.set("q", params.q.trim());
  if (params?.pathwayId?.trim()) search.set("pathwayId", params.pathwayId.trim());
  if (params?.stageId?.trim()) search.set("stageId", params.stageId.trim());
  if (params?.status) search.set("status", params.status);
  if (params?.fresh) search.set("fresh", "1");
  const qs = search.toString();
  const url = qs ? `/api/v1/clients?${qs}` : "/api/v1/clients";
  const res = await apiClient.get<ApiEnvelope<ClientsListResponseData>>(url, { signal: options?.signal });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function listPublishedStagesForPathway(
  pathwayId: string,
  options?: RequestOptions,
): Promise<PublishedStageRowDto[]> {
  const res = await apiClient.get<ApiEnvelope<PublishedPathwayStagesResponseData>>(
    `/api/v1/pathways/${pathwayId}/published-stages`,
    { signal: options?.signal },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  const stages = res.data.data.version.stages;
  return [...stages].sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listPathwaysForTenant(options?: RequestOptions): Promise<PathwayOption[]> {
  const res = await apiClient.get<ApiEnvelope<PathwaysListResponseData>>("/api/v1/pathways", {
    signal: options?.signal,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.pathways;
}

export async function createClient(body: CreateClientRequestBody): Promise<ClientDto> {
  const res = await apiClient.post<ApiEnvelope<CreateClientResponseData>>("/api/v1/clients", body);
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.client;
}

export async function createPatientSelfRegisterInvite(
  body?: CreatePatientSelfRegisterInviteRequestBody,
): Promise<CreatePatientSelfRegisterInviteResponseData> {
  const payload: CreatePatientSelfRegisterInviteRequestBody =
    body?.clientId != null && body.clientId !== "" ? { clientId: body.clientId } : {};
  const res = await apiClient.post<ApiEnvelope<CreatePatientSelfRegisterInviteResponseData>>(
    "/api/v1/clients/self-register-invites",
    payload,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateClient(
  clientId: string,
  body: PatchClientRequestBody,
): Promise<ClientDto> {
  const res = await apiClient.patch<ApiEnvelope<UpdateClientResponseData>>(
    `/api/v1/clients/${clientId}`,
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.client;
}

export async function softDeleteClient(clientId: string): Promise<void> {
  const res = await apiClient.delete<ApiEnvelope<{ message: string }>>(`/api/v1/clients/${clientId}`, {
    skipErrorToast: true,
  });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}

export async function listClientFiles(
  clientId: string,
  params?: ClientFilesListQueryParams,
  options?: RequestOptions,
): Promise<ClientFilesListResponseData> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  const url = qs
    ? `/api/v1/clients/${clientId}/files?${qs}`
    : `/api/v1/clients/${clientId}/files`;
  const res = await apiClient.get<ApiEnvelope<ClientFilesListResponseData>>(url, { signal: options?.signal });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function requestFileDownloadPresign(
  body: FileDownloadPresignRequestBody,
): Promise<FileDownloadPresignResponseData> {
  const res = await apiClient.post<ApiEnvelope<FileDownloadPresignResponseData>>(
    "/api/v1/files/presign-download",
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function deleteClientFile(clientId: string, fileId: string): Promise<void> {
  const res = await apiClient.delete<ApiEnvelope<{ message: string }>>(
    `/api/v1/clients/${clientId}/files/${fileId}`,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}

export async function reviewPatientPortalClientFile(
  clientId: string,
  fileId: string,
  body: { decision: "approve" | "reject"; rejectReason?: string },
): Promise<{ fileId: string; patientPortalReviewStatus: PatientPortalFileReviewStatusDto }> {
  const res = await apiClient.patch<
    ApiEnvelope<{ fileId: string; patientPortalReviewStatus: PatientPortalFileReviewStatusDto }>
  >(`/api/v1/clients/${clientId}/files/${fileId}/review`, body);
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function createPatientPathway(
  input: CreatePatientPathwayRequestBody,
): Promise<PatientPathwayCreated> {
  const res = await apiClient.post<ApiEnvelope<CreatePatientPathwayResponseData>>(
    "/api/v1/patient-pathways",
    input,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.patientPathway;
}

export async function createPatientPortalLink(
  clientId: string,
  body?: { sendEmail?: boolean },
): Promise<PostClientPortalLinkResponse> {
  const res = await apiClient.post<ApiEnvelope<PostClientPortalLinkResponse>>(
    `/api/v1/clients/${clientId}/portal-link`,
    body ?? {},
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}
