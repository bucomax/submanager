import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type {
  AgendaEventDto,
  AgendaListResponseData,
  CreateAgendaEventRequestBody,
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

