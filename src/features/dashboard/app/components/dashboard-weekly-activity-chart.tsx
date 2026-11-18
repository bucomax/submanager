"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type WeeklyActivityDayItem = {
  dayKey: string;
  label: string;
  dateLong: string;
  transitions: number;
  newPathways: number;
  completions: number;
};

type DashboardWeeklyActivityChartProps = {
  items: WeeklyActivityDayItem[];
};

export function DashboardWeeklyActivityChart({ items }: DashboardWeeklyActivityChartProps) {
  const t = useTranslations("dashboard.home.charts.weeklyActivity");

  const maxVal = Math.max(
    1,
    ...items.flatMap((i) => [i.transitions, i.newPathways, i.completions]),
  );

  return (
    <div>
      <div className="text-muted-foreground mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-tight">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary size-2 shrink-0 rounded-sm" aria-hidden />
          {t("legendTransitions")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-sm bg-warning" aria-hidden />
          {t("legendNew")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 shrink-0 rounded-sm bg-success" aria-hidden />
          {t("legendClosed")}
        </span>
      </div>

      <div className="flex h-40 gap-1 sm:gap-1.5">
        {items.map((item) => {
          const hTrans = (item.transitions / maxVal) * 100;
          const hNew = (item.newPathways / maxVal) * 100;
          const hDone = (item.completions / maxVal) * 100;

          return (
            <Tooltip key={item.dayKey}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="flex min-h-0 min-w-0 flex-1 cursor-default flex-col gap-2 rounded-md p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("columnAria", {
                      dateLong: item.dateLong,
                      weekday: item.label,
                      transitions: item.transitions,
                      newPathways: item.newPathways,
                      completions: item.completions,
                    })}
                  >
                    <div className="relative flex min-h-0 flex-1 items-end justify-center gap-0.5 px-0.5">
                      <BarSegment
                        className="bg-primary"
                        heightPct={hTrans}
                        value={item.transitions}
                      />
                      <BarSegment
                        className="bg-warning"
                        heightPct={hNew}
                        value={item.newPathways}
                      />
                      <BarSegment
                        className="bg-success"
                        heightPct={hDone}
                        value={item.completions}
                      />
                    </div>
                    <span className="text-muted-foreground shrink-0 text-center text-[11px] leading-tight">
                      {item.label}
                    </span>
                  </button>
                }
              />
              <TooltipContent side="top" className="max-w-[min(22rem,calc(100vw-2rem))] text-left text-sm">
                <div className="space-y-1.5">
                  <p className="font-medium">{t("tooltipHeading", { dateLong: item.dateLong, weekday: item.label })}</p>
                  <p className="text-background/90">{t("tooltipTransitions", { count: item.transitions })}</p>
                  <p className="text-background/90">{t("tooltipNew", { count: item.newPathways })}</p>
                  <p className="text-background/90">{t("tooltipClosed", { count: item.completions })}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function BarSegment({
  className,
  heightPct,
  value,
}: {
  className: string;
  heightPct: number;
  value: number;
}) {
  return (
    <div
      className={cn("w-full min-w-0 max-w-[14px] flex-1 rounded-sm", className)}
      style={{
        height: `${heightPct}%`,
        minHeight: value > 0 ? 3 : 0,
      }}
      aria-hidden
    />
  );
}
