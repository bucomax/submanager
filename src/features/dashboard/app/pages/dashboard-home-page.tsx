import { DashboardWeeklyActivityChart } from "@/features/dashboard/app/components/dashboard-weekly-activity-chart";
import { DashboardPipelineSection } from "@/features/dashboard/app/components/dashboard-pipeline-section";
import { getDashboardHomeMetrics } from "@/application/use-cases/dashboard/get-dashboard-home-metrics";
import { dashboardHomePrismaRepository } from "@/infrastructure/repositories/dashboard-home.repository";
import { DashboardPage } from "@/shared/components/layout/dashboard-page";
import type { AppShellUser } from "@/shared/types/layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  Clock,
  PieChart,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  DASHBOARD_CHART_TIMEZONE,
  formatCalendarDayLongLabel,
} from "@/lib/utils/dashboard-chart-calendar";
import { InfoTooltip } from "@/shared/components/ui/info-tooltip";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

type DashboardHomePageProps = {
  user: AppShellUser;
};

export async function DashboardHomePage({ user }: DashboardHomePageProps) {
  const t = await getTranslations("dashboard.home");
  const locale = await getLocale();
  const weekdayLocale = locale === "en" ? "en-US" : "pt-BR";
  const tenantId = user.tenantId ?? null;

  function weekdayShortFromDayKey(dayKeyYmd: string): string {
    const [y, m, d] = dayKeyYmd.split("-").map(Number);
    const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return new Intl.DateTimeFormat(weekdayLocale, { weekday: "short" }).format(noonUtc).replace(/\./g, "");
  }

  const { pathwayOptions: pipelinePathways, metrics } = tenantId
    ? await getDashboardHomeMetrics(tenantId, dashboardHomePrismaRepository, {
        userId: user.id,
        globalRole: user.globalRole,
      })
    : {
        pathwayOptions: [],
        metrics: {
          pathwaysActive: 0,
          transitionsToday: 0,
          awaitingAction: 0,
          pathwaysCompletedToday: 0,
          conversionRate: 0,
          transitionCountsByDay: new Map<string, number>(),
          completionsByDay: new Map<string, number>(),
          startsByDay: new Map<string, number>(),
          dayKeys7: [] as string[],
        },
      };

  const weeklyActivityDays = metrics.dayKeys7.map((dayKey) => ({
    dayKey,
    label: weekdayShortFromDayKey(dayKey),
    dateLong: formatCalendarDayLongLabel(dayKey, locale, DASHBOARD_CHART_TIMEZONE),
    transitions: metrics.transitionCountsByDay.get(dayKey) ?? 0,
    newPathways: metrics.startsByDay.get(dayKey) ?? 0,
    completions: metrics.completionsByDay.get(dayKey) ?? 0,
  }));
  const weeklyActivityTotal = weeklyActivityDays.reduce(
    (s, d) => s + d.transitions + d.newPathways + d.completions,
    0,
  );

  const pathwaysActiveMoving = Math.max(metrics.pathwaysActive - metrics.awaitingAction, 0);
  const distributionChart = [
    { label: t("charts.distribution.awaiting"), value: metrics.awaitingAction },
    { label: t("charts.distribution.active"), value: pathwaysActiveMoving },
    { label: t("charts.distribution.pathwaysClosedToday"), value: metrics.pathwaysCompletedToday },
  ];
  const distributionTotal = distributionChart.reduce((sum, item) => sum + item.value, 0);

  return (
    <DashboardPage>
      {/* Kit: os quatro indicadores numa faixa só; cor só onde há estado (sem ação há 48 h). */}
      <div className="animate-enter bg-card grid grid-cols-2 overflow-hidden rounded-[20px] border xl:grid-cols-4">
        {[
          { icon: Users, label: t("cards.inProgress"), value: String(metrics.pathwaysActive), tone: "" },
          { icon: Activity, label: t("cards.transitionsToday"), value: String(metrics.transitionsToday), tone: "" },
          {
            icon: Clock,
            label: t("cards.awaitingAction"),
            value: String(metrics.awaitingAction),
            tone: metrics.awaitingAction > 0 ? "text-warning" : "",
          },
          { icon: TrendingUp, label: t("cards.conversionRate"), value: `${metrics.conversionRate}%`, tone: "" },
        ].map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn(
              "flex min-w-0 flex-col gap-1.5 px-6 py-5",
              i % 2 === 1 && "border-l",
              i >= 2 && "border-t xl:border-t-0",
              i === 2 && "xl:border-l",
            )}
          >
            <p className={cn("text-muted-foreground flex items-center gap-1.5 text-[13px]", kpi.tone && `${kpi.tone} font-semibold`)}>
              <kpi.icon className="size-4 shrink-0" aria-hidden />
              {kpi.label}
            </p>
            <p className="text-foreground text-[34px] leading-none font-extrabold tracking-[-0.04em] tabular-nums">{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="animate-enter grid gap-4 [--i:1] lg:grid-cols-2 lg:items-stretch">
        <div className="bg-card text-card-foreground h-full min-h-0 rounded-[20px] border p-6">
          <div className="mb-4 flex items-start justify-between gap-2">
            <p className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-[17px] font-bold tracking-tight">
              <BarChart3 className="text-primary size-4 shrink-0" aria-hidden />
              {t("charts.weeklyActivity.title")}
            </p>
            <InfoTooltip ariaLabel={t("charts.weeklyActivity.infoAria")}>{t("charts.weeklyActivity.caption")}</InfoTooltip>
          </div>
          {weeklyActivityTotal === 0 ? (
            <p className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-center text-sm">
              {t("charts.weeklyActivity.empty")}
            </p>
          ) : (
            <DashboardWeeklyActivityChart items={weeklyActivityDays} />
          )}
        </div>
        <div className="bg-card text-card-foreground h-full min-h-0 rounded-[20px] border p-6">
          <div className="mb-4 flex items-start justify-between gap-2">
            <p className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-[17px] font-bold tracking-tight">
              <PieChart className="text-primary size-4 shrink-0" aria-hidden />
              {t("charts.distribution.title")}
            </p>
            <InfoTooltip ariaLabel={t("charts.distribution.infoAria")}>{t("charts.distribution.caption")}</InfoTooltip>
          </div>
          <div className="space-y-3">
            {distributionChart.map((item) => {
              const pct = distributionTotal > 0 ? Math.round((item.value / distributionTotal) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-medium">
                      {item.value} ({pct}%)
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div className="bg-brand h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mt-8 h-64 w-full rounded-xl" />}>
        <DashboardPipelineSection pathways={pipelinePathways} />
      </Suspense>
    </DashboardPage>
  );
}
