import type { DayCount, IDashboardHomeRepository } from "@/application/ports/dashboard-home-repository.port";
import {
  buildClientVisibilityFlatFilter,
  loadTenantMembershipClientScope,
} from "@/application/use-cases/shared/load-client-visibility-scope";
import {
  calendarDayKeyInTimeZone,
  DASHBOARD_CHART_TIMEZONE,
  lastNCalendarDaysInTimeZone,
  startOfSaoPauloCalendarDay,
} from "@/lib/utils/dashboard-chart-calendar";

export type DashboardPathwayOption = {
  id: string;
  name: string;
  publishedVersion: { id: string; version: number } | null;
};

export type DashboardHomeMetrics = {
  pathwaysActive: number;
  transitionsToday: number;
  awaitingAction: number;
  pathwaysCompletedToday: number;
  conversionRate: number;
  transitionCountsByDay: Map<string, number>;
  completionsByDay: Map<string, number>;
  startsByDay: Map<string, number>;
  dayKeys7: string[];
};

export type GetDashboardHomeResult = {
  pathwayOptions: DashboardPathwayOption[];
  metrics: DashboardHomeMetrics;
};

const STALE_HOURS = 48;
const HISTORY_DAYS = 10;
const CHART_DAYS = 7;
const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

export async function getDashboardHomeMetrics(
  tenantId: string,
  dashboardHome: IDashboardHomeRepository,
  viewer: { userId: string; globalRole: string },
): Promise<GetDashboardHomeResult> {
  const now = new Date();
  const todayKeySp = calendarDayKeyInTimeZone(now, DASHBOARD_CHART_TIMEZONE);
  const startTodaySp = startOfSaoPauloCalendarDay(todayKeySp);
  const staleThreshold = new Date(now.getTime() - STALE_HOURS * MS_PER_HOUR);
  const historyFrom = new Date(now.getTime() - HISTORY_DAYS * MS_PER_DAY);

  const repo = dashboardHome;
  const scope = await loadTenantMembershipClientScope(viewer.userId, tenantId, viewer.globalRole);
  const visibility = buildClientVisibilityFlatFilter(scope, viewer.userId);

  // Conversion rate: unique pathways with transitions in last 7 calendar days / active
  const dayKeys7 = lastNCalendarDaysInTimeZone(now, CHART_DAYS, DASHBOARD_CHART_TIMEZONE);
  const last7DaysStart = startOfSaoPauloCalendarDay(dayKeys7[0]!);

  const [
    rawPathways,
    pathwaysActive,
    transitionsToday,
    awaitingAction,
    pathwaysCompletedToday,
    transitionsByDay,
    completionsByDayRows,
    startsByDayRows,
    pathwaysTouchedLast7Days,
  ] = await Promise.all([
    repo.fetchPathwayOptions(tenantId),
    repo.countActivePathways(tenantId, visibility),
    repo.countTransitionsSince(tenantId, startTodaySp, visibility),
    repo.countAwaitingAction(tenantId, staleThreshold, visibility),
    repo.countCompletedSince(tenantId, startTodaySp, visibility),
    repo.countTransitionsByDay(tenantId, historyFrom, visibility),
    repo.countCompletionsByDay(tenantId, historyFrom, visibility),
    repo.countStartsByDay(tenantId, historyFrom, visibility),
    repo.countPathwaysWithTransitionSince(tenantId, last7DaysStart, visibility),
  ]);

  const pathwayOptions: DashboardPathwayOption[] = rawPathways.map((p) => ({
    id: p.id,
    name: p.name,
    publishedVersion: p.versions[0] ?? null,
  }));

  const conversionRate =
    pathwaysActive > 0 ? Math.round((pathwaysTouchedLast7Days / pathwaysActive) * 100) : 0;

  const toDayMap = (rows: DayCount[]) => new Map(rows.map((r) => [r.day, r.count]));
  const transitionCountsByDay = toDayMap(transitionsByDay);
  const completionsByDay = toDayMap(completionsByDayRows);
  const startsByDay = toDayMap(startsByDayRows);

  return {
    pathwayOptions,
    metrics: {
      pathwaysActive,
      transitionsToday,
      awaitingAction,
      pathwaysCompletedToday,
      conversionRate,
      transitionCountsByDay,
      completionsByDay,
      startsByDay,
      dayKeys7,
    },
  };
}
