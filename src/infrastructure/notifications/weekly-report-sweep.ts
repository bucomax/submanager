import { logger } from "@/lib/observability/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { enqueueEmailDispatch } from "@/infrastructure/email/email-dispatch-emitter";
import { generatePathwaySummary } from "@/application/use-cases/report/generate-pathway-summary";
import { SUPER_ADMIN_CLIENT_SCOPE } from "@/domain/client/client-visibility";
import { previousWeekLabelInClinicTz } from "@/lib/utils/clinic-datetime";

export type WeeklyReportSweepSummary = {
  tenants: number;
  enqueued: number;
  failed: number;
  truncated: boolean;
};

const CRITICAL_LIST_LIMIT = 5;
const TOP_STAGES_LIMIT = 3;

/**
 * Resumo semanal: para cada tenant ativo com `notifyWeeklyReport`, gera o resumo da semana fechada anterior
 * (segunda a domingo, fuso da clínica; mesma agregação da tela de Relatórios, sem filtros) e envia aos
 * administradores da clínica. O e-mail é deduplicado por tenant + semana (`weekKey`).
 * Pensado para rodar toda segunda-feira de manhã.
 */
export async function runWeeklyReportSweep(options: {
  budgetMs: number;
  now?: Date;
}): Promise<WeeklyReportSweepSummary> {
  const deadline = Date.now() + options.budgetMs;
  const week = previousWeekLabelInClinicTz(options.now ?? new Date());

  const tenants = await prisma.tenant.findMany({
    where: { isActive: true, notifyWeeklyReport: true },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  let enqueued = 0;
  let failed = 0;
  let truncated = false;

  for (const tenant of tenants) {
    if (Date.now() >= deadline) {
      truncated = true;
      break;
    }
    try {
      const admins = await prisma.tenantMembership.findMany({
        where: { tenantId: tenant.id, role: "tenant_admin" },
        select: { userId: true },
        orderBy: { userId: "asc" },
      });
      const targetUserIds = admins.map((a) => a.userId);
      if (targetUserIds.length === 0) continue;

      const summary = await generatePathwaySummary({
        tenantId: tenant.id,
        periodDays: 7,
        // Mesmo intervalo do rótulo do e-mail (segunda a domingo anteriores, fuso da clínica).
        period: { start: week.start, end: week.end },
        page: 1,
        limit: CRITICAL_LIST_LIMIT,
        scope: SUPER_ADMIN_CLIENT_SCOPE,
        viewerUserId: targetUserIds[0]!,
      });
      // Clínica sem pacientes em jornada: nada a resumir.
      if (summary.kpis.patientsInScope === 0) continue;

      const statusCount = (status: string) => summary.byStatus.find((s) => s.status === status)?.count ?? 0;

      await enqueueEmailDispatch(
        {
          kind: "weekly_report_staff",
          tenantId: tenant.id,
          data: {
            periodLabel: week.label,
            kpis: {
              patients: summary.kpis.patientsInScope,
              transitions: summary.kpis.transitionsInPeriod,
              critical: summary.kpis.criticalPatients,
              pathways: summary.kpis.pathwaysInScope,
            },
            byStatus: { ok: statusCount("ok"), warning: statusCount("warning"), danger: statusCount("danger") },
            topStages: [...summary.byStage]
              .sort((a, b) => b.count - a.count)
              .slice(0, TOP_STAGES_LIMIT)
              .map((s) => ({ label: s.label ?? "Sem etapa", count: s.count })),
            critical: summary.criticalPatients.data.map((c) => ({
              clientId: c.clientId,
              name: c.clientName,
              stageName: c.stageName,
              daysInStage: c.daysInStage,
            })),
            criticalTotal: summary.criticalPatients.pagination.totalItems,
            targetUserIds,
            clinicName: tenant.name?.trim() || "Clínica",
          },
        },
        { jobId: `email|weekly|${tenant.id}|${week.weekKey}` },
      );
      enqueued += 1;
    } catch (err) {
      failed += 1;
      logger.error("[weekly-report] tenant failed", { tenantId: tenant.id, err });
    }
  }

  return { tenants: tenants.length, enqueued, failed, truncated };
}
