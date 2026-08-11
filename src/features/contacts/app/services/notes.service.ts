import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { LeadNoteDto, LeadNotesResponseData, UpsertLeadNoteRequestBody } from "@/types/api/contacts-v1";

export async function listLeadNotes(conversationId: string): Promise<LeadNoteDto[]> {
  const res = await apiClient.get<ApiEnvelope<LeadNotesResponseData>>(
    `/api/v1/tenant/conversations/${conversationId}/notes`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.data;
}

export async function createLeadNote(
  conversationId: string,
  input: UpsertLeadNoteRequestBody,
): Promise<LeadNoteDto> {
  const res = await apiClient.post<ApiEnvelope<LeadNoteDto>>(
    `/api/v1/tenant/conversations/${conversationId}/notes`,
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateLeadNote(
  id: string,
  input: Partial<UpsertLeadNoteRequestBody>,
): Promise<LeadNoteDto> {
  const res = await apiClient.patch<ApiEnvelope<LeadNoteDto>>(
    `/api/v1/tenant/notes/${id}`,
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function deleteLeadNote(id: string): Promise<void> {
  const res = await apiClient.delete<ApiEnvelope<{ id: string }>>(
    `/api/v1/tenant/notes/${id}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}
