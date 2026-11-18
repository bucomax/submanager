import { normalizeApiError } from "@/lib/api/axios-error";
import { apiClient } from "@/lib/api/http-client";
import type { ApiEnvelope } from "@/shared/types/api/v1";
import type { RequestOptions } from "@/types/api/request-options";
import type {
  ReportsSummaryQueryParams,
  ReportsSummaryResponseData,
} from "@/features/dashboard/app/types/api";

export async function getReportsSummary(
  params: ReportsSummaryQueryParams,
  options?: RequestOptions,
): Promise<ReportsSummaryResponseData> {
  try {
    const res = await apiClient.get<ApiEnvelope<ReportsSummaryResponseData>>("/api/v1/reports/summary", {
      params: {
        periodDays: params.periodDays,
        pathwayId: params.pathwayId || undefined,
        opmeSupplierId: params.opmeSupplierId || undefined,
        page: params.page,
        limit: params.limit,
      },
      signal: options?.signal,
    });
    if (!res.data.success) {
      throw new Error(res.data.error.message);
    }
    return res.data.data;
  } catch (e) {
    throw normalizeApiError(e);
  }
}
