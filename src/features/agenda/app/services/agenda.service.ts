import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  AgendaEventDto,
  AgendaListResponseData,
  CreateAgendaEventRequestBody,
  UpdateAgendaEventRequestBody,
} from "@/types/api/agenda-v1";

export async function listAgendaEvents(from: string, to: string): Promise<AgendaEventDto[]> {
  const search = new URLSearchParams({ from, to });
  const res = await apiClient.get<ApiEnvelope<AgendaListResponseData>>(
    `/api/v1/tenant/agenda?${search.toString()}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data.data;
}

export async function createAgendaEvent(input: CreateAgendaEventRequestBody): Promise<AgendaEventDto> {
  const res = await apiClient.post<ApiEnvelope<AgendaEventDto>>(
    "/api/v1/tenant/agenda",
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function updateAgendaEvent(
  id: string,
  input: UpdateAgendaEventRequestBody,
): Promise<AgendaEventDto> {
  const res = await apiClient.patch<ApiEnvelope<AgendaEventDto>>(
    `/api/v1/tenant/agenda/${id}`,
    input,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
  return res.data.data;
}

export async function deleteAgendaEvent(id: string): Promise<void> {
  const res = await apiClient.delete<ApiEnvelope<{ id: string }>>(
    `/api/v1/tenant/agenda/${id}`,
    { skipErrorToast: true },
  );
  if (!res.data.success) {
    throw new Error(res.data.error.message);
  }
}
