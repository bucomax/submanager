import { normalizeApiError } from "@/lib/api/axios-error";
import type { ApiPagination } from "@/lib/api/pagination";
import { apiClient } from "@/lib/api/http-client";
import type { SlaHealthStatus } from "@/domain/pathway/sla-health";
import type {
  DashboardAlertRow,
  DashboardSummaryTotals,
  KanbanColumn,
  KanbanPatientPathway,
} from "@/features/dashboard/app/types";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";

export async function getDashboardSummary(
  pathwayId: string,
  params?: { opmeSupplierId?: string },
  options?: RequestOptions,
): Promise<{
  totals: DashboardSummaryTotals;
}> {
  try {
    const res = await apiClient.get<
      ApiEnvelope<{ pathwayId: string; version: { id: string; version: number }; totals: DashboardSummaryTotals }>
    >(`/api/v1/pathways/${pathwayId}/dashboard-summary`, {
      params: { opmeSupplierId: params?.opmeSupplierId || undefined },
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return { totals: res.data.data.totals };
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getDashboardAlerts(
  pathwayId: string,
  params?: { limit?: number; opmeSupplierId?: string },
  options?: RequestOptions,
): Promise<DashboardAlertRow[]> {
  try {
    const limit = params?.limit ?? 20;
    const res = await apiClient.get<
      ApiEnvelope<{ pathwayId: string; data: DashboardAlertRow[]; pagination: ApiPagination }>
    >(`/api/v1/pathways/${pathwayId}/dashboard-alerts`, {
      params: { limit, opmeSupplierId: params?.opmeSupplierId || undefined },
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data.data;
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getKanban(
  pathwayId: string,
  params: { search?: string; status?: SlaHealthStatus; limit?: number; opmeSupplierId?: string },
  options?: RequestOptions,
): Promise<{ columns: KanbanColumn[] }> {
  try {
    const res = await apiClient.get<ApiEnvelope<{ columns: KanbanColumn[] }>>(
      `/api/v1/pathways/${pathwayId}/kanban`,
      {
        params: {
          search: params.search || undefined,
          status: params.status,
          limit: params.limit,
          opmeSupplierId: params.opmeSupplierId || undefined,
        },
        signal: options?.signal,
      },
    );
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return { columns: res.data.data.columns };
  } catch (e) {
    throw normalizeApiError(e);
  }
}

export async function getKanbanColumnPatients(
  pathwayId: string,
  stageId: string,
  params: { search?: string; limit?: number; page: number; opmeSupplierId?: string },
  options?: RequestOptions,
): Promise<{ data: KanbanPatientPathway[]; pagination: ApiPagination }> {
  try {
    const res = await apiClient.get<
      ApiEnvelope<{ data: KanbanPatientPathway[]; pagination: ApiPagination }>
    >(`/api/v1/pathways/${pathwayId}/kanban/columns/${stageId}/patients`, {
      params: {
        search: params.search || undefined,
        limit: params.limit,
        page: params.page,
        opmeSupplierId: params.opmeSupplierId || undefined,
      },
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return {
      data: res.data.data.data,
      pagination: res.data.data.pagination,
    };
  } catch (e) {
    throw normalizeApiError(e);
  }
}
