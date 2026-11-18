import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  CreatedPathway,
  CreatedPathwayVersion,
  CreatePathwayInput,
  PatchPathwayInput,
  PathwayDetail,
  PathwayListItem,
  PathwayVersionDetail,
  UpdatePathwayDraftInput,
} from "@/features/pathways/app/types/pathways";
import type { PathwayPublishPreviewDto } from "@/types/api/pathways-v1";
import type { RequestOptions } from "@/types/api/request-options";

export async function listPathways(options?: RequestOptions): Promise<PathwayListItem[]> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ pathways: PathwayListItem[] }>>("/api/v1/pathways", {
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.pathways;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function patchPathway(pathwayId: string, body: PatchPathwayInput): Promise<void> {
  try {
    const res = await apiClient.patch<ApiEnvelope<{ pathway: unknown }>>(`/api/v1/pathways/${pathwayId}`, body);
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getPathway(pathwayId: string, options?: RequestOptions): Promise<PathwayDetail> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ pathway: PathwayDetail }>>(`/api/v1/pathways/${pathwayId}`, {
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.pathway;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function postPathway(body: CreatePathwayInput): Promise<CreatedPathway> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ pathway: { id: string; name: string } }>>("/api/v1/pathways", body);
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.pathway;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getPathwayVersion(
  pathwayId: string,
  versionId: string,
  options?: RequestOptions,
): Promise<PathwayVersionDetail> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ version: PathwayVersionDetail }>>(
      `/api/v1/pathways/${pathwayId}/versions/${versionId}`,
      { signal: options?.signal },
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.version;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function postPathwayVersion(
  pathwayId: string,
  graphJson: unknown,
): Promise<CreatedPathwayVersion> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ version: { id: string; version: number } }>>(
      `/api/v1/pathways/${pathwayId}/versions`,
      { graphJson },
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.version;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function patchPathwayVersionDraft(
  pathwayId: string,
  versionId: string,
  graphJson: unknown,
): Promise<void> {
  try {
    const res = await apiClient.patch<ApiEnvelope<{ version: unknown }>>(
      `/api/v1/pathways/${pathwayId}/versions/${versionId}`,
      { graphJson } satisfies UpdatePathwayDraftInput,
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function publishPathwayVersion(pathwayId: string, versionId: string): Promise<void> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ version: unknown }>>(
      `/api/v1/pathways/${pathwayId}/versions/${versionId}/publish`,
      {},
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function postPathwayPublishPreview(
  pathwayId: string,
  versionId: string,
  body: { graphJson?: unknown } = {},
  options?: RequestOptions,
): Promise<PathwayPublishPreviewDto> {
  try {
    const res = await apiClient.post<ApiEnvelope<{ preview: PathwayPublishPreviewDto }>>(
      `/api/v1/pathways/${pathwayId}/versions/${versionId}/publish-preview`,
      body,
      { signal: options?.signal },
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.preview;
  } catch (e) {
    throw normalizeApiError(e);
  }
}
