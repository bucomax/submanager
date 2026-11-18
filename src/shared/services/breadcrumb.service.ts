import { apiClient } from "@/lib/api/http-client";
import type { RequestOptions } from "@/types/api/request-options";

export type BreadcrumbEntityKind = "clients" | "pathways" | "patient-pathways";

/** Nome legível da entidade do último segmento do breadcrumb; `null` quando a API não devolve nome. */
export async function fetchBreadcrumbEntityName(
  kind: BreadcrumbEntityKind,
  id: string,
  options?: RequestOptions,
): Promise<string | null> {
  const signal = options?.signal;
  if (kind === "clients") {
    const { data } = await apiClient.get<{ data: { client: { name: string } } }>(`/api/v1/clients/${id}`, {
      signal,
      skipErrorToast: true,
    });
    return data?.data?.client?.name?.trim() || null;
  }
  if (kind === "pathways") {
    const { data } = await apiClient.get<{ data: { pathway: { name: string } } }>(`/api/v1/pathways/${id}`, {
      signal,
    });
    return data?.data?.pathway?.name?.trim() || null;
  }
  const { data } = await apiClient.get<{ data: { patientPathway: { client: { name: string } } } }>(
    `/api/v1/patient-pathways/${id}`,
    { signal, skipErrorToast: true },
  );
  return data?.data?.patientPathway?.client?.name?.trim() || null;
}
