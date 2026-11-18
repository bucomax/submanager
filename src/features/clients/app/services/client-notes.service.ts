import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  ClientNotesListQueryParams,
  ClientNotesListResponseData,
  CreateClientNoteRequestBody,
  CreateClientNoteResponseData,
} from "@/types/api/client-notes-v1";

export async function listClientNotes(
  clientId: string,
  params?: ClientNotesListQueryParams,
  options?: RequestOptions,
): Promise<ClientNotesListResponseData> {
  const search = new URLSearchParams();
  if (params?.page != null) search.set("page", String(params.page));
  if (params?.limit != null) search.set("limit", String(params.limit));
  const qs = search.toString();
  const url = qs ? `/api/v1/clients/${clientId}/notes?${qs}` : `/api/v1/clients/${clientId}/notes`;
  const res = await apiClient.get<ApiEnvelope<ClientNotesListResponseData>>(url, { signal: options?.signal });
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function createClientNote(
  clientId: string,
  body: CreateClientNoteRequestBody,
): Promise<CreateClientNoteResponseData["note"]> {
  const res = await apiClient.post<ApiEnvelope<CreateClientNoteResponseData>>(
    `/api/v1/clients/${clientId}/notes`,
    body,
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.note;
}
