import { DashboardWeeklyActivityChart } from "@/features/dashboard/app/components/dashboard-weekly-activity-chart";
import { DashboardPipelineSection } from "@/features/dashboard/app/components/dashboard-pipeline-section";
import { getDashboardHomeMetrics } from "@/application/use-cases/dashboard/get-dashboard-home-metrics";
import { dashboardHomePrismaRepository } from "@/infrastructure/repositories/dashboard-home.repository";
import { DashboardPage } from "@/shared/components/layout/dashboard-page";
import type { AppShellUser } from "@/shared/types/layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-l-4 border-l-sky-500 bg-sky-50/60 p-5 text-card-foreground shadow-sm dark:bg-sky-950/25">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-sky-500" aria-hidden />
            <p className="text-muted-foreground text-xs">{t("cards.inProgress")}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold">{metrics.pathwaysActive}</p>
        </div>
        <div className="rounded-xl border border-l-4 border-l-emerald-500 bg-emerald-50/60 p-5 text-card-foreground shadow-sm dark:bg-emerald-950/25">
          <div className="flex items-center gap-2">
            <Activity className="size-4 text-emerald-500" aria-hidden />
            <p className="text-muted-foreground text-xs">{t("cards.transitionsToday")}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold">{metrics.transitionsToday}</p>
        </div>
        <div className="rounded-xl border border-l-4 border-l-amber-500 bg-amber-50/70 p-5 text-card-foreground shadow-sm dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-amber-500" aria-hidden />
            <p className="text-muted-foreground text-xs">{t("cards.awaitingAction")}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold">{metrics.awaitingAction}</p>
        </div>
        <div className="rounded-xl border border-l-4 border-l-violet-500 bg-violet-50/60 p-5 text-card-foreground shadow-sm dark:bg-violet-950/25">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-violet-500" aria-hidden />
            <p className="text-muted-foreground text-xs">{t("cards.conversionRate")}</p>
          </div>
          <p className="mt-2 text-2xl font-semibold">{metrics.conversionRate}%</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className="bg-card text-card-foreground h-full min-h-0 rounded-xl border p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-2">
            <p className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold">
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
        <div className="bg-card text-card-foreground h-full min-h-0 rounded-xl border p-6 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-2">
            <p className="text-foreground flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold">
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
                  <div className="bg-muted h-2 rounded-full">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
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
