import { computeSlaHealthStatus } from "@/domain/pathway/sla-health";
import { pathwaySummaryReportPrismaRepository } from "@/infrastructure/repositories/pathway-summary-report.repository";
import {
  buildClientVisibilityWhereInput,
  type TenantMembershipClientScope,
} from "@/application/use-cases/shared/load-client-visibility-scope";
import { buildPagination } from "@/lib/api/pagination";
import type { ReportsSummaryResponseData } from "@/types/api/reports-v1";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type GeneratePathwaySummaryInput = {
  tenantId: string;
  periodDays: number;
  pathwayId?: string;
  opmeSupplierId?: string;
  page: number;
  limit: number;
  scope: TenantMembershipClientScope;
  viewerUserId: string;
};

/**
 * Agrega pacientes no período, SLA por etapa e lista paginada de casos críticos.
 */
export async function generatePathwaySummary(
  input: GeneratePathwaySummaryInput,
): Promise<ReportsSummaryResponseData> {
  const { tenantId, periodDays, pathwayId, opmeSupplierId, page, limit, scope, viewerUserId } = input;
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * MS_PER_DAY);

  const { rows, transitionsInPeriod } = await pathwaySummaryReportPrismaRepository.fetchScanData({
    tenantId,
    periodStart,
    pathwayId,
    opmeSupplierId,
    clientVisibilityWhere: buildClientVisibilityWhereInput(scope, viewerUserId),
  });

  const byStageMap = new Map<string, { id: string; label: string; count: number; sortOrder: number }>();
  const byPathwayMap = new Map<string, { id: string; label: string; count: number }>();
  const byOpmeMap = new Map<string, { id: string | null; label: string | null; count: number }>();
  const byStatus = {
    ok: 0,
    warning: 0,
    danger: 0,
  };

  const criticalRows = rows
    .map((row) => {
      const status = computeSlaHealthStatus(
        row.enteredStageAt,
        now,
        row.currentStage.alertWarningDays,
        row.currentStage.alertCriticalDays,
      );
      const daysInStage = Math.floor((now.getTime() - row.enteredStageAt.getTime()) / MS_PER_DAY);

      byStatus[status] += 1;

      const stageCurrent = byStageMap.get(row.currentStage.id);
      byStageMap.set(row.currentStage.id, {
        id: row.currentStage.id,
        label: row.currentStage.name,
        count: (stageCurrent?.count ?? 0) + 1,
        sortOrder: row.currentStage.sortOrder,
      });

      const pathwayCurrent = byPathwayMap.get(row.pathway.id);
      byPathwayMap.set(row.pathway.id, {
        id: row.pathway.id,
        label: row.pathway.name,
        count: (pathwayCurrent?.count ?? 0) + 1,
      });

      const opmeId = row.client.opmeSupplier?.id ?? "__unassigned__";
      const opmeCurrent = byOpmeMap.get(opmeId);
      byOpmeMap.set(opmeId, {
        id: row.client.opmeSupplier?.id ?? null,
        label: row.client.opmeSupplier?.name ?? null,
        count: (opmeCurrent?.count ?? 0) + 1,
      });

      return {
        patientPathwayId: row.id,
        clientId: row.client.id,
        clientName: row.client.name,
        phone: row.client.phone,
        pathwayName: row.pathway.name,
        stageName: row.currentStage.name,
        daysInStage,
        status,
        opmeSupplierName: row.client.opmeSupplier?.name ?? null,
      };
    })
    .filter((row) => row.status === "danger")
    .sort((a, b) => b.daysInStage - a.daysInStage);

  const offset = (page - 1) * limit;
  const pageRows = criticalRows.slice(offset, offset + limit);

  return {
    generatedAt: now.toISOString(),
    filters: {
      periodDays,
      pathwayId: pathwayId ?? null,
      opmeSupplierId: opmeSupplierId ?? null,
    },
    kpis: {
      patientsInScope: rows.length,
      criticalPatients: criticalRows.length,
      transitionsInPeriod,
      pathwaysInScope: byPathwayMap.size,
    },
    byStage: [...byStageMap.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ id: s.id, label: s.label, count: s.count })),
    byStatus: [
      { status: "ok", count: byStatus.ok },
      { status: "warning", count: byStatus.warning },
      { status: "danger", count: byStatus.danger },
    ],
    byPathway: [...byPathwayMap.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    byOpme: [...byOpmeMap.values()].sort(
      (a, b) => b.count - a.count || (a.label ?? "").localeCompare(b.label ?? ""),
    ),
    criticalPatients: {
      data: pageRows,
      pagination: buildPagination(page, limit, criticalRows.length),
    },
  };
}
